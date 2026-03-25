import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseDto } from '../../response-dto';
import { AuthService } from '../auth.service';
import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { ResponseTransformInterceptor } from '../../interceptors/response-transform-interceptor';
import { ApiExtraModels } from '@nestjs/swagger';
import { UserResponseDto } from '../dto/user-dto/response-dto/user-response-dto';
import { ErrorApiResponse } from '../../decorators/error-api-response-decorator';
import { GenericApiResponse } from '../../decorators/generic-api-response-decorator';
import { ResponseMsg } from '../../decorators/response-message-decorator';
import { AdminSignUpRequestDto } from '../dto/user-dto/request-dto/user-sign-up-request-dto';
import { UserTokenResponseDto } from '../dto/token-dto/response-dto/user-token-response-dto';

@ApiTags('관리자 인증')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@Controller('/adminAuth')
export class AdminAuthController {
  constructor(private authService: AuthService) {}

  // 1. 관리자 회원가입
  @ApiOperation({
    summary: '관리자 회원가입',
  })
  @GenericApiResponse({
    status: 201,
    description: '관리자 회원가입 성공',
    message: 'Administer signed up successfully',
    model: UserResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'email must be an email',
    error: 'BadRequestException',
  })
  @ResponseMsg('Administer signed up successfully')
  @Post('/signup')
  async adminSignUp(
    @Body() userSignUpRequestDto: AdminSignUpRequestDto,
  ): Promise<UserResponseDto> {
    const admin = await this.authService.adminSignUp(userSignUpRequestDto);
    const userResponseDto = new UserResponseDto(admin);
    return userResponseDto;
  }

  // 2. 관리자 로그인 엔드포인트
  @ApiOperation({
    summary: '관리자 로그인',
  })
  @GenericApiResponse({
    status: 201,
    description: '로그인 성공',
    message: 'Admin signed in successfully',
    model: UserTokenResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'adminId should not be empty',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '잘못된 adminId 혹은 email',
    message: 'Incorrect adminId or email',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Admin signed in successfully')
  @Post('/signin')
  async adminSignIn(
    @Body() adminSignInRequestDto: AdminSignUpRequestDto,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserResponseDto;
  }> {
    // [1] 로그인 처리
    const { accessToken, refreshToken, admin } =
      await this.authService.adminSignIn(
        adminSignInRequestDto.adminId,
        adminSignInRequestDto.email,
      );

    const userResponseDto = new UserResponseDto(admin);

    // [2] 응답 반환 JSON으로 토큰 전송
    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: userResponseDto,
    };
  }
}
