import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../decorators/get-user-decorator';
import { ResponseTransformInterceptor } from '../interceptors/response-transform-interceptor';
import { ResponseDto } from '../response-dto';
import { GenericApiResponse } from '../decorators/generic-api-response-decorator';
import { ErrorApiResponse } from '../decorators/error-api-response-decorator';
import { ResponseMsg } from '../decorators/response-message-decorator';
import { NullApiResponse } from '../decorators/null-api-response-decorator';
import { UserEntity } from '../auth/entity/user/user.entity';
import { ProfileService } from './profile.service';
import { ProfileResponseDto } from './dto/response-dto/profile-response-dto';
import { UpdateNicknameRequestDto } from './dto/request-dto/update-nickname-request-dto';
import { UpdateGenderRequestDto } from './dto/request-dto/update-gender-request-dto';
import { UpdateBirthYearRequestDto } from './dto/request-dto/update-birthYear-request-dto';
import { UpdateHeightRequestDto } from './dto/request-dto/update-height-request-dto';
import { UpdateWeightRequestDto } from './dto/request-dto/update-weight-request-dto';
import { UpdateActivityRequestDto } from './dto/request-dto/update-activity-request-dto';
import { UpdateGoalRequestDto } from './dto/request-dto/update-goal-request-dto';
import { UpdateTargetWeightRequestDto } from './dto/request-dto/update-target-weight-request-dto';
import { UpdateTargetCaloriesRequestDto } from './dto/request-dto/update-target-calories-request-dto';
import { UpdateTargetRatioRequestDto } from './dto/request-dto/update-target-ratio-request-dto';
import { RegisterSubCodeRequestDto } from './dto/request-dto/register-subCode-request-dto';
import { CreateInquiryRequestDto } from './dto/request-dto/create-inquiry-request-dto';

@ApiTags('프로필')
@UseInterceptors(ResponseTransformInterceptor)
@ApiExtraModels(ResponseDto)
@ApiBearerAuth('accessToken')
@Controller('/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiOperation({ summary: '유저 정보 반환' })
  @GenericApiResponse({
    status: 200,
    description: '유저 정보 반환 성공',
    message: 'Profile returned successfully',
    model: ProfileResponseDto,
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Profile returned successfully')
  @UseGuards(AuthGuard())
  @Get('/getProfile')
  async getProfile(@GetUser() user: UserEntity): Promise<ProfileResponseDto> {
    return await this.profileService.getProfile(user);
  }

  @ApiOperation({ summary: '닉네임 수정' })
  @GenericApiResponse({
    status: 200,
    description: '닉네임 수정 성공',
    message: 'Nickname updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'nickname should not be empty',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Nickname updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateNickname')
  async updateNickname(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateNicknameRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateNickname(user, dto);
  }

  @ApiOperation({ summary: '성별 수정' })
  @GenericApiResponse({
    status: 200,
    description: '성별 수정 성공',
    message: 'Gender updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'gender must be one of the following values: 0, 1',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Gender updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateGender')
  async updateGender(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateGenderRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateGender(user, dto);
  }

  @ApiOperation({ summary: '출생 연도 수정' })
  @GenericApiResponse({
    status: 200,
    description: '출생 연도 수정 성공',
    message: 'Birth year updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'birthYear must not be greater than the allowed maximum',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Birth year updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateBirthYear')
  async updateBirthYear(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateBirthYearRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateBirthYear(user, dto);
  }

  @ApiOperation({ summary: '신장 수정' })
  @GenericApiResponse({
    status: 200,
    description: '신장 수정 성공',
    message: 'Height updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'height must be a number conforming to the specified constraints',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Height updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateHeight')
  async updateHeight(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateHeightRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateHeight(user, dto);
  }

  @ApiOperation({ summary: '현재 체중 수정' })
  @GenericApiResponse({
    status: 200,
    description: '현재 체중 수정 성공',
    message: 'Weight updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'weight must be a number conforming to the specified constraints',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Weight updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateWeight')
  async updateWeight(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateWeightRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateWeight(user, dto);
  }

  @ApiOperation({ summary: '활동량 수정' })
  @GenericApiResponse({
    status: 200,
    description: '활동량 수정 성공',
    message: 'Activity updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'activity must be one of the following values: 0, 1, 2, 3',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Activity updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateActivity')
  async updateActivity(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateActivityRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateActivity(user, dto);
  }

  @ApiOperation({ summary: '목표 수정' })
  @GenericApiResponse({
    status: 200,
    description: '목표 수정 성공',
    message: 'Goal updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'goal must be one of the following values: 0, 1, 2',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Goal updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateGoal')
  async updateGoal(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateGoalRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateGoal(user, dto);
  }

  @ApiOperation({ summary: '목표 체중 수정' })
  @GenericApiResponse({
    status: 200,
    description: '목표 체중 수정 성공',
    message: 'Target weight updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message:
      'target_weight must be a number conforming to the specified constraints',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Target weight updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateTargetWeight')
  async updateTargetWeight(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateTargetWeightRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateTargetWeight(user, dto);
  }

  @ApiOperation({ summary: '목표 칼로리 수정' })
  @GenericApiResponse({
    status: 200,
    description: '목표 칼로리 수정 성공',
    message: 'Target calories updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'target_calories must be an integer number',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Target calories updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateTargetCalories')
  async updateTargetCalories(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateTargetCaloriesRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateTargetCalories(user, dto);
  }

  @ApiOperation({ summary: '목표 탄단지 비율 수정' })
  @GenericApiResponse({
    status: 200,
    description: '목표 탄단지 비율 수정 성공',
    message: 'Target ratio updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'ratio sum must be 100',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ResponseMsg('Target ratio updated successfully')
  @UseGuards(AuthGuard())
  @Post('/updateTargetRatio')
  async updateTargetRatio(
    @GetUser() user: UserEntity,
    @Body() dto: UpdateTargetRatioRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.updateTargetRatio(user, dto);
  }

  @ApiOperation({ summary: '구독 코드 입력' })
  @GenericApiResponse({
    status: 200,
    description: '구독 코드 입력 성공',
    message: 'Subscription code updated successfully',
    model: ProfileResponseDto,
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'subCode should not be empty',
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
  @ErrorApiResponse({
    status: 404,
    description: '유저 정보가 아직 등록되지 않음',
    message: 'User info not found',
    error: 'NotFoundException',
  })
  @ErrorApiResponse({
    status: 409,
    description: '이미 다른 유저가 사용 중인 구독 코드',
    message: 'Your subCode already exists',
    error: 'ConflictException',
  })
  @ResponseMsg('Subscription code updated successfully')
  @UseGuards(AuthGuard())
  @Post('/registerSubCode')
  async registerSubCode(
    @GetUser() user: UserEntity,
    @Body() dto: RegisterSubCodeRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.profileService.registerSubCode(user, dto);
  }

  @ApiOperation({ summary: '문의하기' })
  @NullApiResponse({
    status: 201,
    description: '문의 등록 성공',
    message: 'Inquiry submitted successfully',
  })
  @ErrorApiResponse({
    status: 400,
    description: 'Bad Request  \nbody 입력값의 필드 조건 및 JSON 형식 오류',
    message: 'content should not be empty',
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
  @ResponseMsg('Inquiry submitted successfully')
  @UseGuards(AuthGuard())
  @Post('/inquiry')
  async inquiry(
    @GetUser() user: UserEntity,
    @Body() dto: CreateInquiryRequestDto,
  ): Promise<void> {
    await this.profileService.inquiry(user, dto);
  }
}
