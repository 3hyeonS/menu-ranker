import {
  Injectable,
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

@Injectable()
export class AuthService {
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
    private jwtService: JwtService,
    private httpService: HttpService,
  ) {}

  // 문자 출력
  getHello(): string {
    return 'Welcome Autorization';
  }

  // userAuth controller
  // 카카오 정보 회원 가입
  async signUpWithKakao(
    profile: any,
    kakaoUserId: string,
  ): Promise<UserEntity> {
    const kakaoAccount = profile.kakao_account;

    const kakaoUserNickname = kakaoAccount.profile.nickname;
    const kakaoEmail = kakaoAccount.email;

    // 카카오 프로필 데이터를 기반으로 사용자 찾기 또는 생성 로직을 구현
    const existingUser = await this.userRepository.findOne({
      where: {
        email: kakaoEmail,
        signWith: { platform: 'KAKAO' },
      },
    });
    if (existingUser?.kakaoKey?.kakaoId === kakaoUserId) {
      return existingUser;
    }

    // 새 사용자 생성 로직
    const newUser = await this.userRepository.save({
      nickname: kakaoUserNickname,
      email: kakaoEmail,
      signWith: await this.signWithRepository.findOneBy({ platform: 'KAKAO' }),
      authority: await this.authorityRepository.findOneBy({ role: 'USER' }),
    });

    await this.kakaoKeyRepository.save({
      kakaoId: kakaoUserId,
      user: newUser,
    });

    return await this.userRepository.findOneBy({ id: newUser.id });
  }

  // 카카오 로그인
  async signInWithKakao(
    kakaoAuthResCode: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: UserEntity }> {
    try {
      // Authorization Code로 Kakao API에 Access Token 요청
      const kakaoAccessToken = await this.getKakaoAccessToken(kakaoAuthResCode);

      // Access Token으로 Kakao 사용자 정보, 회원번호 요청
      const kakaoUserInfo = await this.getKakaoUserInfo(kakaoAccessToken);
      const kakaoUserId = await this.getKakaoUserId(kakaoAccessToken);

      // 카카오 사용자 정보를 기반으로 회원가입 또는 로그인 처리
      const user = await this.signUpWithKakao(kakaoUserInfo, kakaoUserId);

      // [1] JWT 토큰 생성 (Secret + Payload)
      const accessToken = await this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user);
      // [2] 사용자 정보 반환
      return { accessToken, refreshToken, user };
    } catch (error) {
      throw new UnauthorizedException('Authorization code is Invalid');
    }
  }

  // Kakao Authorization Code로 Kakao Access Token 요청
  async getKakaoAccessToken(code: string): Promise<string> {
    const tokenUrl = 'https://kauth.kakao.com/oauth/token';
    const payload = {
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_CLIENT_ID, // Kakao REST API Key
      redirect_uri: process.env.KAKAO_REDIRECT_URI,
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
  async signInWithApple(
    payload: any,
  ): Promise<{ accessToken: string; refreshToken: string; user: UserEntity }> {
    try {
      const { sub: appleId } = await appleSignin.verifyIdToken(
        payload.id_token,
      );

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
      // [2] 사용자 정보 반환
      return { accessToken, refreshToken, user };
    } catch (err) {
      // Token is not verified
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
    const newUser = await this.userRepository.save({
      nickname: name,
      email: email,
      signWith: await this.signWithRepository.findOneBy({ platform: 'APPLE' }),
      authority: await this.authorityRepository.findOneBy({ role: 'USER' }),
    });

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
}
