import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation } from '@nestjs/swagger';
import { ApiTags } from '@nestjs/swagger';
import { ResponseTransformInterceptor } from '../../interceptors/response-transform-interceptor';
import { ResponseDto } from '../../response-dto';
import { AuthService } from '../auth.service';
import { AuthGuard } from '@nestjs/passport';
import { GenericApiResponse } from '../../decorators/generic-api-response-decorator';
import { ErrorApiResponse } from '../../decorators/error-api-response-decorator';
import { UserTokenResponseDto } from '../dto/token-dto/response-dto/user-token-response-dto';
import { ResponseMsg } from '../../decorators/response-message-decorator';
import { UserResponseDto } from '../dto/user-dto/response-dto/user-response-dto';
import { PrimitiveApiResponse } from '../../decorators/primitive-api-response-decorator';
import { DefaltTargetCaloriesRequestDto } from '../dto/user-dto/request-dto/default-target-calories-request-dto';
import { DefaltRatioResponseDto } from '../dto/user-dto/response-dto/default-target-ratio-response-dto';
import { DefaltRatioRequestDto } from '../dto/user-dto/request-dto/default-target-ratio-request-dto';
import { UserInfoResponseDto } from '../dto/user-dto/response-dto/user-info-response-dto';
import { Roles } from '../../decorators/roles-decorator';
import { RolesGuard } from '../custom-role.guard';
import { GetUser } from '../../decorators/get-user-decorator';
import { UserEntity } from '../entity/user/user.entity';
import { RegisterUserInfoRequestDto } from '../dto/user-dto/request-dto/register-user-info-request-dto';
import { RegisterSubCodeRequestDto } from '../../profile/dto/request-dto/register-subCode-request-dto';

@ApiTags('유저 인증')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@Controller('/userAuth')
export class UserAuthController {
  constructor(private authService: AuthService) {}

  // 1. 카카오 로그인/회원가입 페이지 요청
  @ApiOperation({
    summary: '카카오 로그인/회원가입 페이지',
    description: `카카오 로그인/회원가입 페이지로 redirect  \n
    Swagger에서 redirect 테스트 불가. 외부에서 해당 엔드포인트 호출`,
  })
  @Get('/kakao')
  @UseGuards(AuthGuard('kakao'))
  async kakaoLogin() {
    // 이 부분은 Passport의 AuthGuard에 의해 카카오 로그인 페이지로 리다이렉트
  }

  @ApiOperation({
    summary: '웹 카카오 로그인 페이지',
    description: '웹 전용 redirect_uri로 카카오 로그인 페이지로 redirect',
  })
  @Get('/kakao/web')
  async kakaoWebLogin(@Res() response): Promise<void> {
    const clientId = process.env.KAKAO_CLIENT_ID;
    const redirectUri = process.env.KAKAO_WEB_REDIRECT_URI;

    if (!clientId) {
      throw new BadRequestException('KAKAO_CLIENT_ID is required');
    }

    if (!redirectUri) {
      throw new BadRequestException('KAKAO_WEB_REDIRECT_URI is required');
    }

    const authorizationUrl =
      'https://kauth.kakao.com/oauth/authorize' +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    response.redirect(authorizationUrl);
  }

  // 2. 카카오 로그인 콜백 엔드포인트
  @ApiOperation({
    summary: '카카오 로그인 콜백',
    description: '카카오 로그인 콜백 및 accessToken, refreshToken 생성',
  })
  @GenericApiResponse({
    status: 201,
    description: '카카오 로그인에 성공',
    message: 'Signed in successfully with KaKao Account',
    model: UserTokenResponseDto,
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않은 인가코드 입력(재사용 포함)',
    message: 'Authorization code is invalid',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Signed in successfully with KaKao Account')
  @Post('/kakao/callback')
  async kakaoCallback(@Query('code') kakaoAuthResCode: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserResponseDto;
  }> {
    const { accessToken, refreshToken, user, isSubscribed } =
      await this.authService.signInWithKakao(kakaoAuthResCode);

    const userResponseDto = new UserResponseDto(user, isSubscribed);
    return {
      accessToken: accessToken, // 헤더로 사용할 Access Token
      refreshToken: refreshToken, // 클라이언트 보안 저장소에 저장할 Refresh Token
      user: userResponseDto,
    };
  }

  @ApiOperation({
    summary: '웹 카카오 로그인 콜백',
    description:
      '웹 프론트가 KAKAO_WEB_REDIRECT_URI로 받은 authorization code를 전달하면 JWT를 발급',
  })
  @GenericApiResponse({
    status: 200,
    description: '웹 카카오 로그인에 성공',
    message: 'Signed in successfully with Kakao Web Account',
    model: UserTokenResponseDto,
  })
  @ResponseMsg('Signed in successfully with Kakao Web Account')
  @Post('/kakao/web/callback')
  async kakaoWebCallback(@Query('code') kakaoAuthResCode: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserResponseDto;
  }> {
    if (!kakaoAuthResCode) {
      throw new BadRequestException('code is required');
    }

    const { accessToken, refreshToken, user, isSubscribed } =
      await this.authService.signInWithKakao(
        kakaoAuthResCode,
        process.env.KAKAO_WEB_REDIRECT_URI,
      );

    const userResponseDto = new UserResponseDto(user, isSubscribed);
    return {
      accessToken,
      refreshToken,
      user: userResponseDto,
    };
  }

  // 3. 애플 로그인/회원가입 페이지 요청
  @ApiOperation({
    summary: '애플 로그인/회원가입 페이지',
    description: `애플 로그인/회원가입 페이지로 redirect  \n
    Swagger에서 redirect 테스트 불가. 외부에서 해당 엔드포인트 호출`,
  })
  @Get('/apple')
  @UseGuards(AuthGuard('apple'))
  async appleLogin() {
    // 이 부분은 Passport의 AuthGuard에 의해 애플 로그인 페이지로 리다이렉트
  }

  // 4. 애플 로그인 콜백 엔드포인트
  @ApiOperation({
    summary: '애플 로그인 콜백',
    description: '애플 로그인 콜백 및 accessToken, refreshToken 생성',
  })
  @GenericApiResponse({
    status: 201,
    description: '애플 로그인에 성공',
    message: 'Signed in successfully with Apple Account',
    model: UserTokenResponseDto,
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않은 Apple ID_Token',
    message: 'ID Token is invalid',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Signed in successfully with Apple Account')
  @Post('/apple/callback')
  async appleCallback(@Body() payload): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserResponseDto;
  }> {
    const { accessToken, refreshToken, user, isSubscribed } =
      await this.authService.signInWithApple(payload);

    const userResponseDto = new UserResponseDto(user, isSubscribed);
    return {
      accessToken: accessToken, // 헤더로 사용할 Access Token
      refreshToken: refreshToken, // 클라이언트 보안 저장소에 저장할 Refresh Token
      user: userResponseDto,
    };
  }

  // 추천 목표 칼로리 계산
  @ApiOperation({
    summary: '추천 목표 칼로리 계산',
  })
  @PrimitiveApiResponse({
    status: 201,
    description: '추천 목표 칼로리 계산 완료',
    message: 'defalt target calories calculated successfully',
    type: 'number',
    example: 1487,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'height must be a number conforming to the specified constraints',
    error: 'BadRequestException',
  })
  @ResponseMsg('defalt target calories calculated successfully')
  @Post('/defaltTargetCalories')
  async defaltTargetCalories(
    @Body() defaltTargetCaloriesRequestDto: DefaltTargetCaloriesRequestDto,
  ): Promise<number> {
    return await this.authService.defaltTargetCalories(
      defaltTargetCaloriesRequestDto,
    );
  }

  // 추천 탄단지 비율 계산
  @ApiOperation({
    summary: '추천 탄단지 비율 계산',
  })
  @GenericApiResponse({
    status: 201,
    description: '추천 탄단지 비율 계산 완료',
    message: 'defalt ratio calculated successfully',
    model: DefaltRatioResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'height must be a number conforming to the specified constraints',
    error: 'BadRequestException',
  })
  @ResponseMsg('defalt target calories calculated successfully')
  @Post('/defaltRatio')
  async defaltRatio(
    @Body() defaltRatioRequestDto: DefaltRatioRequestDto,
  ): Promise<DefaltRatioResponseDto> {
    return await this.authService.defautRatio(defaltRatioRequestDto);
  }

  // 유저 정보 등록
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '유저 정보 등록',
  })
  @GenericApiResponse({
    status: 201,
    description: '유저 정보 등록 성공',
    message: 'User Info registered successfully',
    model: UserInfoResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description:
      'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류, 구독 코드 누락 또는 비활성 구독 코드',
    message: 'ratio sum must be 100',
    error: 'BadRequestException',
    examples: {
      validationError: {
        summary: '프로필 입력값 오류',
        value: {
          message: 'ratio sum must be 100',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      emptySubCode: {
        summary: '구독 코드 공백',
        value: {
          message: 'subCode must not be empty',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      inactiveSubCode: {
        summary: '구독 코드 비활성/기간 오류',
        value: {
          message: 'Subscription code is not active',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
    },
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 acccessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 403,
    description: '유저 회원이 아님 (유저 회원만 정보 등록 가능)',
    message: 'Not a member of the USER (only USER can call this api)',
    error: 'ForbiddenException',
  })
  @ErrorApiResponse({
    status: 404,
    description: '존재하지 않는 구독 코드',
    message: 'Subscription code not found',
    error: 'NotFoundException',
    examples: {
      subCodeNotFound: {
        summary: '존재하지 않는 구독 코드',
        value: {
          message: 'Subscription code not found',
          statusCode: 404,
          error: 'NotFoundException',
        },
      },
    },
  })
  @ErrorApiResponse({
    status: 409,
    description:
      '이미 등록된 유저 정보가 있거나 구독 코드가 이미 사용됨/사용 한도 초과',
    message: 'Your profile already exists',
    error: 'ConflictException',
    examples: {
      profileAlreadyExists: {
        summary: '이미 등록된 유저 정보',
        value: {
          message: 'Your profile already exists',
          statusCode: 409,
          error: 'ConflictException',
        },
      },
      subCodeAlreadyUsedByUser: {
        summary: '같은 유저가 같은 구독 코드 재사용',
        value: {
          message: 'Your subCode already exists',
          statusCode: 409,
          error: 'ConflictException',
        },
      },
      subCodeUsageLimitExceeded: {
        summary: '구독 코드 사용 한도 초과',
        value: {
          message: 'Subscription code usage limit exceeded',
          statusCode: 409,
          error: 'ConflictException',
        },
      },
    },
  })
  @ResponseMsg('User Info registered successfully')
  @UseGuards(AuthGuard())
  @Post('registerUserInfo')
  async registerUserInfo(
    @GetUser() user: UserEntity,
    @Body() registerUserInfoRequestDto: RegisterUserInfoRequestDto,
  ): Promise<UserInfoResponseDto> {
    return await this.authService.registerUserInfo(
      user,
      registerUserInfoRequestDto,
    );
  }

  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '구독 코드 인가',
    description:
      '웹 카카오 로그인 후 프로필 등록 여부와 무관하게 구독 코드를 인가',
  })
  @PrimitiveApiResponse({
    status: 201,
    description: '구독 코드 인가 성공',
    message: 'Subscription code authorized successfully',
    type: 'boolean',
    example: true,
  })
  @ErrorApiResponse({
    status: 400,
    description: '유효하지 않거나 비활성화된 구독 코드',
    message: 'Subscription code is not active',
    error: 'BadRequestException',
    examples: {
      emptySubCode: {
        summary: '구독 코드 누락',
        value: {
          message: 'subCode must not be empty',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      inactiveSubCode: {
        summary: '구독 코드 비활성/기간 오류',
        value: {
          message: 'Subscription code is not active',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
    },
  })
  @ErrorApiResponse({
    status: 404,
    description: '존재하지 않는 구독 코드',
    message: 'Subscription code not found',
    error: 'NotFoundException',
  })
  @ErrorApiResponse({
    status: 409,
    description: '이미 사용했거나 사용 한도가 초과된 구독 코드',
    message: 'Your subCode already exists',
    error: 'ConflictException',
    examples: {
      subCodeAlreadyUsedByUser: {
        summary: '같은 유저가 같은 구독 코드 재사용',
        value: {
          message: 'Your subCode already exists',
          statusCode: 409,
          error: 'ConflictException',
        },
      },
      subCodeUsageLimitExceeded: {
        summary: '구독 코드 사용 한도 초과',
        value: {
          message: 'Subscription code usage limit exceeded',
          statusCode: 409,
          error: 'ConflictException',
        },
      },
    },
  })
  @ResponseMsg('Subscription code authorized successfully')
  @UseGuards(AuthGuard())
  @Post('/authorizeSubCode')
  async authorizeSubCode(
    @GetUser() user: UserEntity,
    @Body() dto: RegisterSubCodeRequestDto,
  ): Promise<boolean> {
    return await this.authService.authorizeSubscriptionCode(user, dto.subCode);
  }

  // 유저 정보 등록 여부 확인
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '유저 정보 등록 여부 확인',
    description:
      'true: 등록됨  \nfalse: 등록 되지 않음(온보딩 화면으로 리다이렉트 필요)',
  })
  @PrimitiveApiResponse({
    status: 201,
    description: '유저 정보 등록 여부 확인 성공',
    message: 'User info registration verified successfully',
    type: 'boolean',
    example: true,
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 acccessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 403,
    description: '유저 회원이 아님 (유저 회원만 공고 등록 가능)',
    message: 'Not a member of the USER (only USER can call this api)',
    error: 'ForbiddenException',
  })
  @ResponseMsg('User info registration verified successfully')
  @UseGuards(AuthGuard())
  @Post('hasUserInfo')
  async hasUserInfo(@GetUser() user: UserEntity): Promise<boolean> {
    return await this.authService.hasUserInfo(user);
  }
}
