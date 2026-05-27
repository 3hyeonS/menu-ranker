import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { UserEntity } from '../auth/entity/user/user.entity';
import { UserInfoEntity } from '../auth/entity/user/userInfo.entity';
import { roundToOneDecimal } from '../utils/number.util';
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
import { InquiryEntity } from './entity/inquiry.entity';
import { UserGoalEntity } from '../auth/entity/user/userGoal.entity';
import { GetUserGoalSnapshotRequestDto } from './dto/request-dto/get-user-goal-snapshot-request-dto';
import { UserGoalSnapshotResponseDto } from './dto/response-dto/user-goal-snapshot-response-dto';
import { SubscriptionService } from '../auth/subscription.service';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserInfoEntity)
    private readonly userInfoRepository: Repository<UserInfoEntity>,
    @InjectRepository(UserGoalEntity)
    private readonly userGoalRepository: Repository<UserGoalEntity>,
    @InjectRepository(InquiryEntity)
    private readonly profileInquiryRepository: Repository<InquiryEntity>,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async getProfile(user: UserEntity): Promise<ProfileResponseDto> {
    const [savedUser, userInfo, isSubscribed] = await Promise.all([
      this.userRepository.findOneBy({ id: user.id }),
      this.getUserInfoOrThrow(user.id),
      this.subscriptionService.hasActiveSubscription(user.id),
    ]);

    return new ProfileResponseDto(savedUser, userInfo, isSubscribed);
  }

  async updateNickname(
    user: UserEntity,
    dto: UpdateNicknameRequestDto,
  ): Promise<ProfileResponseDto> {
    const savedUser = await this.userRepository.findOneBy({ id: user.id });
    const nickname = dto.nickname.trim();
    const duplicatedUser = await this.userRepository.findOneBy({ nickname });

    if (duplicatedUser && duplicatedUser.id !== user.id) {
      throw new ConflictException('Nickname already exists');
    }

    savedUser.nickname = nickname;
    await this.userRepository.save(savedUser);
    return await this.getProfile(savedUser);
  }

  async updateGender(
    user: UserEntity,
    dto: UpdateGenderRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.updateUserInfo(user.id, { gender: dto.gender });
  }

  async updateBirthYear(
    user: UserEntity,
    dto: UpdateBirthYearRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.updateUserInfo(user.id, { birthYear: dto.birthYear });
  }

  async updateHeight(
    user: UserEntity,
    dto: UpdateHeightRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.updateUserInfo(user.id, {
      height: roundToOneDecimal(dto.height),
    });
  }

  async updateWeight(
    user: UserEntity,
    dto: UpdateWeightRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.updateUserInfo(user.id, {
      weight: roundToOneDecimal(dto.weight),
    });
  }

  async updateActivity(
    user: UserEntity,
    dto: UpdateActivityRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.updateUserInfo(user.id, { activity: dto.activity });
  }

  async updateGoal(
    user: UserEntity,
    dto: UpdateGoalRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.updateUserInfo(user.id, { goal: dto.goal });
  }

  async updateTargetWeight(
    user: UserEntity,
    dto: UpdateTargetWeightRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.updateUserInfo(user.id, {
      target_weight: roundToOneDecimal(dto.target_weight),
    });
  }

  async updateTargetCalories(
    user: UserEntity,
    dto: UpdateTargetCaloriesRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.updateUserInfo(user.id, {
      target_calories: dto.target_calories,
    });
  }

  async updateTargetRatio(
    user: UserEntity,
    dto: UpdateTargetRatioRequestDto,
  ): Promise<ProfileResponseDto> {
    return await this.updateUserInfo(user.id, {
      target_ratio: dto.target_ratio,
    });
  }

  async registerSubCode(
    user: UserEntity,
    dto: RegisterSubCodeRequestDto,
  ): Promise<ProfileResponseDto> {
    await this.getUserInfoOrThrow(user.id);
    await this.subscriptionService.authorizeSubscriptionCode(user, dto.subCode);

    return await this.getProfile(user);
  }

  async inquiry(user: UserEntity, dto: CreateInquiryRequestDto): Promise<void> {
    await this.profileInquiryRepository.save(
      this.profileInquiryRepository.create({
        content: dto.content.trim(),
        user,
      }),
    );
  }

  async getUserGoalSnapshot(
    user: UserEntity,
    dto: GetUserGoalSnapshotRequestDto,
  ): Promise<UserGoalSnapshotResponseDto> {
    // 요청 날짜의 "당일 끝"까지를 기준으로 가장 가까운 과거 스냅샷을 우선 조회합니다.
    const targetDate = new Date(dto.date);
    targetDate.setHours(23, 59, 59, 999);

    let userGoalSnapshot = await this.userGoalRepository.findOne({
      where: {
        user: { id: user.id },
        createdAt: LessThanOrEqual(targetDate),
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
    });

    // 해당 날짜 이전 스냅샷이 없으면 전체 이력 중 가장 최근 스냅샷으로 fallback 합니다.
    if (!userGoalSnapshot) {
      userGoalSnapshot = await this.userGoalRepository.findOne({
        where: {
          user: { id: user.id },
        },
        order: {
          createdAt: 'DESC',
          id: 'DESC',
        },
      });
    }

    if (!userGoalSnapshot) {
      throw new NotFoundException('User goal snapshot not found');
    }

    return new UserGoalSnapshotResponseDto(userGoalSnapshot);
  }

  private async updateUserInfo(
    userId: number,
    partial: Partial<UserInfoEntity>,
  ): Promise<ProfileResponseDto> {
    const [savedUser, userInfo] = await Promise.all([
      this.userRepository.findOneBy({ id: userId }),
      this.getUserInfoOrThrow(userId),
    ]);

    Object.assign(userInfo, partial);
    const updatedUserInfo = await this.userInfoRepository.save(userInfo);

    // 프로필 수정 시점의 목표 상태를 user_goal 이력 테이블에 함께 스냅샷 저장합니다.
    await this.userGoalRepository.save(
      this.userGoalRepository.create({
        activity: updatedUserInfo.activity,
        goal: updatedUserInfo.goal,
        target_weight: updatedUserInfo.target_weight,
        target_calories: updatedUserInfo.target_calories,
        target_ratio: updatedUserInfo.target_ratio,
        user: savedUser,
      }),
    );

    const isSubscribed =
      await this.subscriptionService.hasActiveSubscription(userId);

    return new ProfileResponseDto(savedUser, updatedUserInfo, isSubscribed);
  }

  private async getUserInfoOrThrow(userId: number): Promise<UserInfoEntity> {
    const userInfo = await this.userInfoRepository.findOne({
      where: {
        user: { id: userId },
      },
    });

    if (!userInfo) {
      throw new NotFoundException('User info not found');
    }

    return userInfo;
  }
}
