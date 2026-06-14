import {
  ConflictException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, lastValueFrom, retry } from 'rxjs';
import { RefreshTokenEntity } from './entity/refreshToken.entity';
import appleSignin from 'apple-signin-auth';
import { SignWithEntity } from './entity/user/signWith.entity';
import { AuthorityEntity } from './entity/authority.entity';
import { KakaoKeyEntity } from './entity/user/kakaoKey.entity';
import { AppleKeyEntity } from './entity/user/appleKey.entity';
import { UserEntity } from './entity/user/user.entity';
import { AdminSignUpRequestDto } from './dto/user-dto/request-dto/user-sign-up-request-dto';
import { DefaltTargetCaloriesRequestDto } from './dto/user-dto/request-dto/default-target-calories-request-dto';
import { DefaltRatioRequestDto } from './dto/user-dto/request-dto/default-target-ratio-request-dto';
import { DefaltRatioResponseDto } from './dto/user-dto/response-dto/default-target-ratio-response-dto';
import { RegisterUserInfoRequestDto } from './dto/user-dto/request-dto/register-user-info-request-dto';
import { UserInfoResponseDto } from './dto/user-dto/response-dto/user-info-response-dto';
import { roundToOneDecimal } from '../utils/number.util';
import { UserInfoEntity } from './entity/user/userInfo.entity';
import { UserGoalEntity } from './entity/user/userGoal.entity';
import { SubscriptionService } from './subscription.service';

const AUTO_ADMIN_EMAILS = new Set([
  'psa0020@kakao.com',
  '425269@naver.com',
  'oioigl@naver.com',
  'lordsong5974@naver.com',
]);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private refreshTokenRepository: Repository<RefreshTokenEntity>,
    @InjectRepository(SignWithEntity)
    private signWithRepository: Repository<SignWithEntity>,
    @InjectRepository(AuthorityEntity)
    private authorityRepository: Repository<AuthorityEntity>,
    @InjectRepository(KakaoKeyEntity)
    private kakaoKeyRepository: Repository<KakaoKeyEntity>,
    @InjectRepository(AppleKeyEntity)
    private appleKeyRepository: Repository<AppleKeyEntity>,
    @InjectRepository(UserInfoEntity)
    private userInfoRepository: Repository<UserInfoEntity>,
    @InjectRepository(UserGoalEntity)
    private userGoalRepository: Repository<UserGoalEntity>,
    private jwtService: JwtService,
    private httpService: HttpService,
    private subscriptionService: SubscriptionService,
  ) {}

  // 문자 출력
  getHello(): string {
    return 'Welcome Autorization';
  }

  private buildDefaultNickname(userId: number): string {
    return `멜로유저${userId}`;
  }

  private buildAmplitudeUserId(userId: number): string {
    return `melo_user_${userId}`;
  }

  private resolveSignUpRoleByEmail(email: string): 'USER' | 'ADMIN' {
    return AUTO_ADMIN_EMAILS.has(email.trim().toLowerCase())
      ? 'ADMIN'
      : 'USER';
  }

  // userAuth controller
  // 카카오 정보 회원 가입
  async signUpWithKakao(
    profile: any,
    kakaoUserId: string,
  ): Promise<UserEntity> {
    const kakaoAccount = profile.kakao_account;

    const kakaoUserNickname = kakaoAccount?.profile?.nickname ?? null;
    const kakaoEmail = kakaoAccount?.email ?? '';

    // 카카오 회원번호를 기준으로 기존 사용자를 찾는다.
    const existingKakaoKey = await this.kakaoKeyRepository.findOne({
      where: {
        kakaoId: kakaoUserId,
      },
      relations: {
        user: true,
      },
    });
    if (existingKakaoKey?.user) {
      return await this.userRepository.findOneBy({
        id: existingKakaoKey.user.id,
      });
    }

    // 새 사용자 생성 로직
    const signUpRole = this.resolveSignUpRoleByEmail(kakaoEmail);
    const newUser = await this.userRepository.save({
      nickname: '멜로유저',
      name: kakaoUserNickname,
      email: kakaoEmail,
      signWith: await this.signWithRepository.findOneBy({ platform: 'KAKAO' }),
      authority: await this.authorityRepository.findOneBy({
        role: signUpRole,
      }),
    });
    newUser.nickname = this.buildDefaultNickname(newUser.id);
    await this.userRepository.save(newUser);

    await this.kakaoKeyRepository.save({
      kakaoId: kakaoUserId,
      user: newUser,
    });

    return await this.userRepository.findOneBy({ id: newUser.id });
  }

  // 카카오 로그인
  async signInWithKakao(
    kakaoAuthResCode: string,
    redirectUri = process.env.KAKAO_REDIRECT_URI,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserEntity;
    isSubscribed: boolean;
  }> {
    try {
      // Authorization Code로 Kakao API에 Access Token 요청
      const kakaoAccessToken = await this.getKakaoAccessToken(
        kakaoAuthResCode,
        redirectUri,
      );

      // Access Token으로 Kakao 사용자 정보, 회원번호 요청
      const kakaoUserInfo = await this.getKakaoUserInfo(kakaoAccessToken);
      const kakaoUserId = await this.getKakaoUserId(kakaoAccessToken);

      // 카카오 사용자 정보를 기반으로 회원가입 또는 로그인 처리
      const user = await this.signUpWithKakao(kakaoUserInfo, kakaoUserId);

      // [1] JWT 토큰 생성 (Secret + Payload)
      const accessToken = await this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user);
      const isSubscribed = await this.subscriptionService.hasActiveSubscription(
        user.id,
      );
      // [2] 사용자 정보 반환
      return { accessToken, refreshToken, user, isSubscribed };
    } catch (error) {
      this.logger.error('Kakao sign-in failed', error?.stack ?? error);

      if (
        error?.response?.config?.url === 'https://kauth.kakao.com/oauth/token'
      ) {
        throw new UnauthorizedException('Authorization code is Invalid');
      }

      throw new InternalServerErrorException('Failed to sign in with Kakao');
    }
  }

  // Kakao Authorization Code로 Kakao Access Token 요청
  async getKakaoAccessToken(
    code: string,
    redirectUri = process.env.KAKAO_REDIRECT_URI,
  ): Promise<string> {
    console.log('KAKAO code:', code);
    console.log('KAKAO redirectUri:', redirectUri);
    const tokenUrl = 'https://kauth.kakao.com/oauth/token';
    const payload = {
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_CLIENT_ID, // Kakao REST API Key
      redirect_uri: redirectUri,
      code,
      // client_secret: process.env.KAKAO_CLIENT_SECRET, // 필요시 사용
    };

    const response = await firstValueFrom(
      this.httpService.post(tokenUrl, null, {
        params: payload,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    return response.data.access_token; // Access Token 반환
  }

  // Kakao Access Token으로 Kakao 사용자 정보 요청
  async getKakaoUserInfo(accessToken: string): Promise<any> {
    const userInfoUrl = 'https://kapi.kakao.com/v2/user/me';
    const response = await firstValueFrom(
      this.httpService.get(userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return response.data;
  }

  // Kakao Access Token 으로 Kakao 회원 번호 요청
  async getKakaoUserId(accessToken: string): Promise<string> {
    const tokenInfoUrl = 'https://kapi.kakao.com/v1/user/access_token_info';
    const response = await firstValueFrom(
      this.httpService.get(tokenInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return response.data.id.toString();
  }

  // apple 로그인
  async signInWithApple(payload: any): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserEntity;
    isSubscribed: boolean;
  }> {
    try {
      const appleIdTokenClaims = await appleSignin.verifyIdToken(
        payload.id_token,
        {
          audience: process.env.APPLE_CLIENT_ID,
          ignoreExpiration: false,
        },
      );

      const { sub: appleId } = appleIdTokenClaims;

      const clientSecret = appleSignin.getClientSecret({
        clientID: process.env.APPLE_CLIENT_ID, // Apple Client ID
        teamID: process.env.APPLE_TEAM_ID, // Apple Developer Team ID.
        privateKey: process.env.APPLE_PRIVATE_KEY,
        // privateKeyPath: process.env.APPLE_KEYFILE_PATH, // private key associated with your client ID. -- Or provide a `privateKeyPath` property instead.
        keyIdentifier: process.env.APPLE_KEY_ID, // identifier of the private key.
        // OPTIONAL
        expAfter: 15777000, // Unix time in seconds after which to expire the clientSecret JWT. Default is now+5 minutes.
      });

      const options = {
        clientID: process.env.APPLE_CLIENT_ID, // Apple Client ID
        redirectUri: process.env.APPLE_CALLBACK_URL, // use the same value which you passed to authorisation URL.
        clientSecret: clientSecret,
      };

      let user: UserEntity;

      if (payload.hasOwnProperty('user')) {
        const userData = JSON.parse(payload.user);
        const email = userData.email || '';
        const firstName = userData.name?.firstName || '';
        const lastName = userData.name?.lastName || '';
        const name = lastName + firstName;

        // 애플 사용자 정보를 기반으로 회원가입 처리
        const { refresh_token: appleRefreshToken } =
          await appleSignin.getAuthorizationToken(payload.code, options);
        user = await this.signUpWithApple(
          name,
          email,
          appleId,
          appleRefreshToken,
        );
      } else {
        // 기존 애플 사용자 정보 불러오기
        const appleKey = await this.appleKeyRepository.findOneBy({ appleId });
        user = await this.userRepository.findOne({
          where: {
            appleKey: { id: appleKey.id },
          },
        });
      }

      // [1] JWT 토큰 생성 (Secret + Payload)
      const accessToken = await this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user);
      const isSubscribed = await this.subscriptionService.hasActiveSubscription(
        user.id,
      );
      // [2] 사용자 정보 반환
      return { accessToken, refreshToken, user, isSubscribed };
    } catch (err) {
      // Token is not verified'
      console.log(err);
      throw new UnauthorizedException('ID_Token is invalid');
    }
  }

  // 애플 정보 기반 회원가입 또는 로그인 처리
  async signUpWithApple(
    name: string,
    email: string,
    appleId: string,
    appleRefreshToken: string,
  ): Promise<UserEntity> {
    // 새 사용자 생성 로직
    const signUpRole = this.resolveSignUpRoleByEmail(email);
    const newUser = await this.userRepository.save({
      nickname: '멜로유저',
      name,
      email: email,
      signWith: await this.signWithRepository.findOneBy({ platform: 'APPLE' }),
      authority: await this.authorityRepository.findOneBy({
        role: signUpRole,
      }),
    });
    newUser.nickname = this.buildDefaultNickname(newUser.id);
    await this.userRepository.save(newUser);

    await this.appleKeyRepository.save({
      appleId,
      appleRefreshToken,
      user: newUser,
    });

    return await this.userRepository.findOneBy({ id: newUser.id });
  }

  // adminAuth controller
  // 관리자 회원 가입
  async adminSignUp(
    adminSignUpRequestDto: AdminSignUpRequestDto,
  ): Promise<UserEntity> {
    const { adminId, email } = adminSignUpRequestDto;

    const local = await this.signWithRepository.findOneBy({
      platform: 'LOCAL',
    });

    const admin = await this.authorityRepository.findOneBy({ role: 'ADMIN' });

    return await this.userRepository.save({
      nickname: adminId,
      name: adminId,
      email,
      signWith: local,
      authority: admin,
    });
  }

  // 관리자 로그인 메서드
  async adminSignIn(
    adminId: string,
    email: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    admin: UserEntity;
  }> {
    const existingAdmin = await this.userRepository.findOneBy({
      nickname: adminId,
      email,
    });

    if (
      !existingAdmin ||
      existingAdmin.signWith.platform != 'LOCAL' ||
      existingAdmin.authority.role != 'ADMIN'
    ) {
      throw new UnauthorizedException('Incorrect adminId or email');
    }

    const accessToken = await this.generateAccessToken(existingAdmin);
    const refreshToken = await this.generateRefreshToken(existingAdmin);

    return { accessToken, refreshToken, admin: existingAdmin };
  }

  // commonAuth controller
  // accessToken 생성 공통 메서드
  async generateAccessToken(member: UserEntity): Promise<string> {
    // [1] JWT 토큰 생성 (Secret + Payload)
    const payload = {
      id: member.id,
      email: member.email,
      role: member.authority.role,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.ACCESS_SECRET,
      expiresIn: process.env.ACCESS_EXPIRATION,
    });
    return accessToken;
  }

  // Refresh Token 생성 및 저장
  async generateRefreshToken(member: UserEntity): Promise<string> {
    const payload = {
      id: member.id,
      email: member.email,
      role: member.authority.role,
    };
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.REFRESH_SECRET,
      expiresIn: process.env.REFRESH_EXPIRATION,
    }); // Refresh Token 생성
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 만료
    // expiresAt.setMinutes(expiresAt.getMinutes() + 3);

    await this.refreshTokenRepository.save({
      token: refreshToken,
      expiresAt,
      user: member instanceof UserEntity ? member : null,
    });
    return refreshToken;
  }

  // 해당 refresh Token 삭제 (로그아웃 시)
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenEntity = await this.refreshTokenRepository.findOneBy({
      token: refreshToken,
    });
    if (!tokenEntity || tokenEntity.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refreshToken');
    } else {
      await this.refreshTokenRepository.remove(tokenEntity);
    }
  }

  // 회원 탈퇴 기능
  async deleteUser(member: UserEntity): Promise<void> {
    await this.requestAmplitudeUserDeletion(member.id);

    //해당 signId의 모든 refreshToken 삭제
    await this.revokeRefreshTokenBySignId(member);

    // 탈퇴 처리
    if (member instanceof UserEntity) {
      if (member.signWith.platform == 'KAKAO') {
        await this.unlinkKakao(Number(member.kakaoKey.kakaoId));
      }
      if (member.signWith.platform == 'APPLE') {
        await this.revokeAppleTokens(member.appleKey.appleRefreshToken);
      }
      await this.userRepository.remove(member);
    }
  }

  private async requestAmplitudeUserDeletion(userId: number): Promise<void> {
    const amplitudeUserId = this.buildAmplitudeUserId(userId);
    const credentials = [
      {
        label: 'primary',
        apiKey: process.env.AMPLITUDE_API_KEY,
        apiSecret: process.env.AMPLITUDE_API_SECRET,
      },
      {
        label: 'secondary',
        apiKey: process.env.AMPLITUDE_API_KEY_SECOND,
        apiSecret: process.env.AMPLITUDE_API_SECRET_SECOND,
      },
    ].filter((credential) => credential.apiKey && credential.apiSecret);

    if (credentials.length === 0) {
      this.logger.error('Amplitude credentials are not configured');
      throw new InternalServerErrorException(
        'Amplitude credentials are not configured',
      );
    }

    let lastError: unknown = null;

    for (const credential of credentials) {
      try {
        await this.requestAmplitudeUserDeletionWithCredential(
          userId,
          amplitudeUserId,
          credential.apiKey,
          credential.apiSecret,
          credential.label,
        );
        return;
      } catch (error) {
        lastError = error;
      }
    }

    const amplitudeError = lastError as {
      response?: {
        status?: number;
        data?: unknown;
      };
      message?: string;
    };

    this.logger.error('Amplitude deletion failed', {
      userId,
      amplitudeUserId,
      status: amplitudeError.response?.status,
      data: amplitudeError.response?.data,
      message: amplitudeError.message,
    });
    throw new InternalServerErrorException('Amplitude deletion failed');
  }

  private async requestAmplitudeUserDeletionWithCredential(
    userId: number,
    amplitudeUserId: string,
    apiKey: string,
    apiSecret: string,
    credentialLabel: string,
  ): Promise<void> {
    const authorization = Buffer.from(`${apiKey}:${apiSecret}`).toString(
      'base64',
    );

    try {
      await firstValueFrom(
        this.httpService.post(
          'https://amplitude.com/api/2/deletions/users',
          {
            user_ids: [amplitudeUserId],
            requester: 'oioigl1002@gmail.com',
            ignore_invalid_id: 'True',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Basic ${authorization}`,
            },
          },
        ),
      );
    } catch (error) {
      const amplitudeError = error as {
        response?: {
          status?: number;
          data?: unknown;
        };
        message?: string;
      };

      this.logger.warn('Amplitude deletion attempt failed', {
        userId,
        amplitudeUserId,
        credentialLabel,
        status: amplitudeError.response?.status,
        data: amplitudeError.response?.data,
        message: amplitudeError.message,
      });
      throw error;
    }
  }

  // 앱 어드민 키, Kakao 회원번호로 Kakao 연결 끊기
  async unlinkKakao(kakaoId: number): Promise<void> {
    const unlinkUrl = 'https://kapi.kakao.com/v1/user/unlink';
    const payload = {
      target_id_type: 'user_id',
      target_id: kakaoId,
    };
    const response = await firstValueFrom(
      this.httpService.post(unlinkUrl, null, {
        params: payload,
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_ADMIN_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      }),
    );
    console.log(response.data);
  }

  // apple 탈퇴 시 토큰 삭제
  async revokeAppleTokens(appleRefreshToken: string): Promise<void> {
    const clientSecret = appleSignin.getClientSecret({
      clientID: process.env.APPLE_CLIENT_ID, // Apple Client ID
      teamID: process.env.APPLE_TEAM_ID, // Apple Developer Team ID.
      privateKey: process.env.APPLE_PRIVATE_KEY,
      // privateKeyPath: process.env.APPLE_KEYFILE_PATH, // private key associated with your client ID. -- Or provide a `privateKeyPath` property instead.
      keyIdentifier: process.env.APPLE_KEY_ID, // identifier of the private key.
      // OPTIONAL
      expAfter: 15777000, // Unix time in seconds after which to expire the clientSecret JWT. Default is now+5 minutes.
    });

    const options = {
      clientID: process.env.APPLE_CLIENT_ID, // Apple Client ID
      clientSecret: clientSecret,
      tokenTypeHint: 'refresh_token' as 'refresh_token',
    };
    await appleSignin.revokeAuthorizationToken(appleRefreshToken, options);
  }

  // 해당 아이디의 모든 refresh token 삭제 (회원 탈퇴 시)
  async revokeRefreshTokenBySignId(member: UserEntity): Promise<void> {
    if (member instanceof UserEntity) {
      await this.refreshTokenRepository.delete({
        user: { id: member.id },
      });
    }
  }

  // 만료된 refresh token 삭제
  async removeExpiredTokens(): Promise<void> {
    const now = new Date();
    await this.refreshTokenRepository.delete({ expiresAt: LessThan(now) });
  }

  // Refresh Token 검증
  async validateRefreshToken(refreshToken: string): Promise<UserEntity> {
    const tokenEntity = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
    });

    if (!tokenEntity || tokenEntity.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refreshToken');
    }

    return tokenEntity.user;
  }

  // Access Token 갱신
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    member: UserEntity;
  }> {
    const member = await this.validateRefreshToken(refreshToken);

    // 새 Access Token 생성
    const newAccessToken = await this.generateAccessToken(member);

    // 새 Refresh Token 생성
    const newRefreshToken = await this.generateRefreshToken(member);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      member: member,
    };
  }

  // 추천 목표 칼로리
  async defaltTargetCalories(
    defaltTargetRequestDto: DefaltTargetCaloriesRequestDto,
  ): Promise<number> {
    const [gender, birthYear, height, weight, activity, goal, target_weight] = [
      defaltTargetRequestDto.gender,
      defaltTargetRequestDto.birthYear,
      defaltTargetRequestDto.height,
      defaltTargetRequestDto.weight,
      defaltTargetRequestDto.activity,
      defaltTargetRequestDto.goal,
      defaltTargetRequestDto.target_weight,
    ];

    // bmr 계산
    const age = new Date().getFullYear() - birthYear - 1;
    let bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    if (gender == 1) {
      bmr -= 166;
    }

    // 활동계수 적용
    const activityFactor = 1.2 + 0.175 * activity;
    const TDEE = bmr * activityFactor;

    // 목표치로 TDEE 보정
    let TDEE_goal = TDEE;
    if (target_weight !== weight) {
      switch (goal) {
        case 0:
          if (target_weight > weight) {
            TDEE_goal = TDEE + 200;
            break;
          }
          TDEE_goal = TDEE - 500;
          break;
        case 2:
          if (target_weight < weight) {
            TDEE_goal = TDEE - 300;
            break;
          }
          TDEE_goal = TDEE + 300;
          break;
      }
    }

    return roundToOneDecimal(Math.max(bmr, TDEE_goal));
  }

  // 추천 탄단지 비율
  async defautRatio(
    defaltRatioRequestDto: DefaltRatioRequestDto,
  ): Promise<DefaltRatioResponseDto> {
    const [target_calories, weight, goal, target_weight] = [
      defaltRatioRequestDto.target_calories,
      defaltRatioRequestDto.weight,
      defaltRatioRequestDto.goal,
      defaltRatioRequestDto.target_weight,
    ];

    // 단백질 계산, 지방 기본 비율 설정
    let protein: number;
    let fat = 25;
    switch (goal) {
      case 0:
        if (target_weight > weight) {
          protein = (1.5 * weight * 4) / target_calories;
          break;
        }
        if (target_weight === weight) {
          protein = (1.4 * weight * 4) / target_calories;
          fat = 27;
          break;
        }
        protein = (1.3 * weight * 4) / target_calories;
        break;
      case 1:
        protein = (0.9 * weight * 4) / target_calories;
        fat = 27;
        break;
      case 2:
        if (target_weight < weight) {
          protein = (2 * weight * 4) / target_calories;
          break;
        }
        protein = (1.6 * weight * 4) / target_calories;
        if (target_weight === weight) {
          fat = 27;
        }
        break;
    }

    // 단백질 상하한 적용
    protein *= 100;

    if (protein > 20) {
      protein = 20;
    }
    if (protein < 10) {
      protein = 10;
    }

    // 탄수화물 계산, 지방 비율 보정
    let carbs = 100 - protein - fat;
    if (carbs < 40) {
      fat = fat - (40 - carbs);
      carbs = 40;
    }

    return {
      carbs: roundToOneDecimal(carbs),
      protein: roundToOneDecimal(protein),
      fat: roundToOneDecimal(fat),
    };
  }

  // 유저 정보 입력
  async registerUserInfo(
    user: UserEntity,
    registerUserInfoRequestDto: RegisterUserInfoRequestDto,
  ): Promise<UserInfoResponseDto> {
    const normalizedSubCode = registerUserInfoRequestDto.subCode
      ? this.subscriptionService.normalizeCode(
          registerUserInfoRequestDto.subCode,
        )
      : null;

    const myUserInfo = await this.userInfoRepository.findOne({
      where: {
        user: { id: user.id }, // 명시적으로 id 사용
      },
    });
    if (myUserInfo) {
      throw new ConflictException('Your userInfo already exists');
    }

    if (normalizedSubCode) {
      await this.subscriptionService.validateSubscriptionCode(
        normalizedSubCode,
      );
    }

    const newUserInfo = await this.userInfoRepository.save({
      gender: registerUserInfoRequestDto.gender,
      birthYear: registerUserInfoRequestDto.birthYear,
      height: roundToOneDecimal(registerUserInfoRequestDto.height),
      weight: roundToOneDecimal(registerUserInfoRequestDto.weight),
      activity: registerUserInfoRequestDto.activity,
      goal: registerUserInfoRequestDto.goal,
      target_weight: roundToOneDecimal(
        registerUserInfoRequestDto.target_weight,
      ),
      target_calories: registerUserInfoRequestDto.target_calories,
      target_ratio: registerUserInfoRequestDto.target_ratio,
      subCode: null,
      diet_management_status: registerUserInfoRequestDto.diet_management_status,
      persona_type: registerUserInfoRequestDto.persona_type,
      eating_out_freq_weekly: registerUserInfoRequestDto.eating_out_freq_weekly,
      job_type: registerUserInfoRequestDto.job_type,
      lunch_location: registerUserInfoRequestDto.lunch_location ?? null,
      user: user,
    });

    const newUserGoal = this.userGoalRepository.create({
      activity: newUserInfo.activity,
      goal: newUserInfo.goal,
      target_calories: newUserInfo.target_calories,
      target_ratio: newUserInfo.target_ratio,
      target_weight: newUserInfo.target_weight,
      user: user,
    });

    await this.userGoalRepository.save(newUserGoal);

    if (normalizedSubCode) {
      await this.subscriptionService.authorizeSubscriptionCode(
        user,
        normalizedSubCode,
      );
      newUserInfo.subCode = normalizedSubCode;
    }

    const isSubscribed = await this.subscriptionService.hasActiveSubscription(
      user.id,
    );

    return new UserInfoResponseDto(user, newUserInfo, isSubscribed);
  }

  async authorizeSubscriptionCode(
    user: UserEntity,
    subCode: string,
  ): Promise<boolean> {
    await this.subscriptionService.authorizeSubscriptionCode(user, subCode);
    return true;
  }

  // 유저 정보 보유 여부
  async hasUserInfo(user: UserEntity): Promise<boolean> {
    const myUserInfo = await this.userInfoRepository.findOne({
      where: {
        user: { id: user.id }, // 명시적으로 id 사용
      },
    });
    if (myUserInfo) {
      return true;
    }
    return false;
  }
}
