import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseDto } from '../../response-dto';
import { AuthService } from '../auth.service';
import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ResponseTransformInterceptor } from '../../interceptors/response-transform-interceptor';
import { ApiExtraModels } from '@nestjs/swagger';
import { UserResponseDto } from '../dto/user-dto/response-dto/user-response-dto';
import { ErrorApiResponse } from '../../decorators/error-api-response-decorator';
import { GenericApiResponse } from '../../decorators/generic-api-response-decorator';
import { ResponseMsg } from '../../decorators/response-message-decorator';
import { AdminSignUpRequestDto } from '../dto/user-dto/request-dto/user-sign-up-request-dto';
import { SubscriptionService } from '../subscription.service';
import {
  CreateSubscriptionCodeRequestDto,
  CreateSubscriptionCodesRequestDto,
} from '../dto/subscription-code-dto/request-dto/create-subscription-code-request-dto';
import { SubscriptionCodeResponseDto } from '../dto/subscription-code-dto/response-dto/subscription-code-response-dto';
import { Roles } from '../../decorators/roles-decorator';
import { RolesGuard } from '../custom-role.guard';

@ApiTags('관리자 인증')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@Controller('/adminAuth')
export class AdminAuthController {
  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
  ) {}

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
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 403,
    description: '관리자 회원이 아님 (관리자만 호출 가능)',
    message: 'Not a member of the ADMIN (only ADMIN can call this api)',
    error: 'ForbiddenException',
  })
  @ResponseMsg('Administer signed up successfully')
  @ApiBearerAuth('accessToken')
  @UseGuards(AuthGuard(), RolesGuard)
  @Roles('ADMIN')
  @Post('/signup')
  async adminSignUp(
    @Body() userSignUpRequestDto: AdminSignUpRequestDto,
  ): Promise<UserResponseDto> {
    const admin = await this.authService.adminSignUp(userSignUpRequestDto);
    const userResponseDto = new UserResponseDto(admin);
    return userResponseDto;
  }

  // 2. 관리자 로그인 엔드포인트 (비활성화: 관리자는 Kakao/Apple 로그인 후 DB에서 ADMIN으로 지정)
  @ApiOperation({
    summary: '관리자 로그인 (비활성화)',
    description:
      '항상 403을 반환. 관리자는 Kakao/Apple 로그인 후 DB에서 role을 ADMIN으로 지정해 사용',
  })
  @ErrorApiResponse({
    status: 403,
    description: '관리자 로그인 비활성화',
    message: 'Admin sign-in is disabled',
    error: 'ForbiddenException',
  })
  @Post('/signin')
  adminSignIn(): never {
    throw new ForbiddenException('Admin sign-in is disabled');
  }

  @ApiOperation({
    summary: '구독 코드 발급',
  })
  @GenericApiResponse({
    status: 201,
    description: '구독 코드 발급 성공',
    message: 'Subscription code created successfully',
    model: SubscriptionCodeResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 또는 날짜 범위 오류',
    message: 'expires_at must be after starts_at',
    error: 'BadRequestException',
    examples: {
      validationError: {
        summary: '입력값 검증 오류',
        value: {
          message: 'code should not be empty',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      invalidDateRange: {
        summary: '날짜 범위 오류',
        value: {
          message: 'expires_at must be after starts_at',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
    },
  })
  @ErrorApiResponse({
    status: 409,
    description: '이미 존재하는 구독 코드',
    message: 'Subscription code already exists',
    error: 'ConflictException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 403,
    description: '관리자 회원이 아님 (관리자만 호출 가능)',
    message: 'Not a member of the ADMIN (only ADMIN can call this api)',
    error: 'ForbiddenException',
  })
  @ResponseMsg('Subscription code created successfully')
  @ApiBearerAuth('accessToken')
  @UseGuards(AuthGuard(), RolesGuard)
  @Roles('ADMIN')
  @Post('/subscriptionCodes')
  async createSubscriptionCode(
    @Body() dto: CreateSubscriptionCodeRequestDto,
  ): Promise<SubscriptionCodeResponseDto> {
    const subscriptionCode =
      await this.subscriptionService.createSubscriptionCode(dto);

    return new SubscriptionCodeResponseDto(subscriptionCode);
  }

  @ApiOperation({
    summary: '구독 코드 일괄 발급',
  })
  @GenericApiResponse({
    status: 201,
    description: '구독 코드 일괄 발급 성공',
    message: 'Subscription codes created successfully',
    model: SubscriptionCodeResponseDto,
    isArray: true,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 또는 날짜 범위 오류',
    message: 'expires_at must be after starts_at',
    error: 'BadRequestException',
    examples: {
      validationError: {
        summary: '입력값 검증 오류',
        value: {
          message: 'codes should not be empty',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
      invalidDateRange: {
        summary: '날짜 범위 오류',
        value: {
          message: 'expires_at must be after starts_at',
          statusCode: 400,
          error: 'BadRequestException',
        },
      },
    },
  })
  @ErrorApiResponse({
    status: 409,
    description: '요청 코드 중 중복이 있거나 이미 존재하는 구독 코드',
    message: 'Subscription code already exists',
    error: 'ConflictException',
  })
  @ErrorApiResponse({
    status: 401,
    description: '유효하지 않거나 기간이 만료된 accessToken',
    message: 'Invalid or expired accessToken',
    error: 'UnauthorizedException',
  })
  @ErrorApiResponse({
    status: 403,
    description: '관리자 회원이 아님 (관리자만 호출 가능)',
    message: 'Not a member of the ADMIN (only ADMIN can call this api)',
    error: 'ForbiddenException',
  })
  @ResponseMsg('Subscription codes created successfully')
  @ApiBearerAuth('accessToken')
  @UseGuards(AuthGuard(), RolesGuard)
  @Roles('ADMIN')
  @Post('/subscriptionCodes/bulk')
  async createSubscriptionCodes(
    @Body() dto: CreateSubscriptionCodesRequestDto,
  ): Promise<SubscriptionCodeResponseDto[]> {
    const subscriptionCodes =
      await this.subscriptionService.createSubscriptionCodes(dto);

    return subscriptionCodes.map(
      (subscriptionCode) => new SubscriptionCodeResponseDto(subscriptionCode),
    );
  }
}
