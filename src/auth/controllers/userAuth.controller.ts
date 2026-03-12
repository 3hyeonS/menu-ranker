import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UseInterceptors } from '@nestjs/common';
import { ApiExtraModels, ApiOperation } from '@nestjs/swagger';
import { ApiTags } from '@nestjs/swagger';
import { ResponseTransformInterceptor } from 'src/interceptors/response-transform-interceptor';
import { ResponseDto } from 'src/response-dto';
import { AuthService } from '../auth.service';
import { AuthGuard } from '@nestjs/passport';
import { GenericApiResponse } from 'src/decorators/generic-api-response-decorator';
import { ErrorApiResponse } from 'src/decorators/error-api-response-decorator';
import { UserTokenResponseDto } from '../dto/token-dto/response-dto/user-token-response-dto';
import { ResponseMsg } from 'src/decorators/response-message-decorator';
import { UserResponseDto } from '../dto/user-dto/response-dto/user-response-dto';
import { PrimitiveApiResponse } from 'src/decorators/primitive-api-response-decorator';
import { DefaltTargetCaloriesRequestDto } from '../dto/user-dto/request-dto/default-target-calories-request-dto';
import { DefaltRatioResponseDto } from '../dto/user-dto/response-dto/default-target-ratio-response-dto';
import { DefaltRatioRequestDto } from '../dto/user-dto/request-dto/default-target-ratio-request-dto';

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
    const { accessToken, refreshToken, user } =
      await this.authService.signInWithKakao(kakaoAuthResCode);

    const userResponseDto = new UserResponseDto(user);
    return {
      accessToken: accessToken, // 헤더로 사용할 Access Token
      refreshToken: refreshToken, // 클라이언트 보안 저장소에 저장할 Refresh Token
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
    const { accessToken, refreshToken, user } =
      await this.authService.signInWithApple(payload);

    const userResponseDto = new UserResponseDto(user);
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
}
