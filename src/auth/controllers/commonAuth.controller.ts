import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../../decorators/get-user-decorator';
import { JwtService } from '@nestjs/jwt';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ResponseTransformInterceptor } from '../../interceptors/response-transform-interceptor';
import { ResponseMsg } from '../../decorators/response-message-decorator';
import { ResponseDto } from '../../response-dto';
import { GenericApiResponse } from '../../decorators/generic-api-response-decorator';
import { RefreshTokenRequestDto } from '../dto/token-dto/request-dto/refreshToken-request-dto';
import { NullApiResponse } from '../../decorators/null-api-response-decorator';
import { ErrorApiResponse } from '../../decorators/error-api-response-decorator';
import { CustomUnauthorizedExceptionFilter } from '../custom-unauthorizedException-filter';
import { UserResponseDto } from '../dto/user-dto/response-dto/user-response-dto';
import { UserEntity } from '../entity/user/user.entity';
import { UserTokenResponseDto } from '../dto/token-dto/response-dto/user-token-response-dto';

@ApiTags('공통 인증')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@Controller('/commonAuth')
export class CommonAuthController {
  constructor(
    private authService: AuthService,
    private readonly jwtService: JwtService, // JwtService 주입
  ) {}

  // //문자 출력
  // @ApiOperation({
  //   summary: 'Welcome Authorization 출력',
  // })
  // @PrimitiveApiResponse({
  //   status: 200,
  //   description: '문자 출력 성공',
  //   message: 'String printed successfully',
  //   type: 'string',
  //   example: 'Welcome Authorization',
  // })
  // @ResponseMsg('String printed successfully')
  // @Get()
  // getHello(): string {
  //   return this.authService.getHello();
  // }

  // 1. 로그아웃: 해당 refreshToken, fcm 토큰 삭제
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '로그아웃',
    description: '해당 refreshToken, fcm 토큰 삭제',
  })
  @NullApiResponse({
    status: 201,
    description: '로그아웃 성공',
    message: 'Signed out successfully',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'refreshToken must be a jwt string',
    error: 'BadRequestException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 refreshToken',
    message: 'Invalid or expired refreshToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Signed out successfully')
  @UseGuards(AuthGuard())
  @Post('/signout')
  async signout(
    @GetUser() member: UserEntity,
    @Body() refreshTokenRequestDto: RefreshTokenRequestDto,
  ): Promise<void> {
    // refresh token 에서 signId 추출
    const decodedToken = (await this.jwtService.decode(
      refreshTokenRequestDto.refreshToken,
    )) as any;
    const email = decodedToken?.email;
    if (!email) {
      throw new UnauthorizedException('Invalid or expired refreshToken');
    }
    await this.authService.revokeRefreshToken(
      refreshTokenRequestDto.refreshToken,
    );
  }

  // 2. 회원 탈퇴
  @ApiBearerAuth('accessToken')
  @ApiOperation({
    summary: '회원 탈퇴',
    description: '회원 탈퇴 및 refreshToken 삭제',
  })
  @NullApiResponse({
    status: 201,
    description: '회원 탈퇴 성공',
    message: 'Account deleted successfully',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 acccessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ResponseMsg('Account deleted successfully')
  @Post('/delete')
  @UseGuards(AuthGuard()) // JWT 인증이 필요한 엔드포인트
  @UseFilters(CustomUnauthorizedExceptionFilter)
  async deleteUser(@GetUser() member: UserEntity) {
    await this.authService.deleteUser(member);
  }

  // 3. 토큰 재발급
  @ApiOperation({
    summary: '토큰 재발급',
    description: 'accessToken 기간 만료 시 accessToken 및 refreshToken 재발급',
  })
  @GenericApiResponse({
    status: 201,
    description: '토큰 재발급 성공',
    message: 'Token refreshed successfully',
    model: UserTokenResponseDto,
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 refreshToken',
    message: 'Invalid or expired refreshToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'refreshToken must be a jwt string',
    error: 'BadRequestException',
  })
  @ResponseMsg('Token refreshed successfully')
  @Post('/refresh')
  async refresh(
    @Body() refreshTokenRequestDto: RefreshTokenRequestDto,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    member: UserResponseDto;
  }> {
    // refresh token 에서 signId 추출
    const decodedToken = (await this.jwtService.decode(
      refreshTokenRequestDto.refreshToken,
    )) as any;
    const email = decodedToken?.email;
    if (!email) {
      throw new UnauthorizedException('Invalid or expired refreshToken');
    }
    const {
      accessToken,
      refreshToken: newRefreshToken,
      member,
    } = await this.authService.refreshAccessToken(
      refreshTokenRequestDto.refreshToken,
    );
    const responseDto = new UserResponseDto(member);
    return {
      accessToken: accessToken,
      refreshToken: newRefreshToken,
      member: responseDto,
    };
  }
}
