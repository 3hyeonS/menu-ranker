import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserInfoEntity)
    private readonly userInfoRepository: Repository<UserInfoEntity>,
    @InjectRepository(InquiryEntity)
    private readonly profileInquiryRepository: Repository<InquiryEntity>,
  ) {}

  async getProfile(user: UserEntity): Promise<ProfileResponseDto> {
    const [savedUser, userInfo] = await Promise.all([
      this.userRepository.findOneBy({ id: user.id }),
      this.getUserInfoOrThrow(user.id),
    ]);

    return new ProfileResponseDto(savedUser, userInfo);
  }

  async updateNickname(
    user: UserEntity,
    dto: UpdateNicknameRequestDto,
  ): Promise<ProfileResponseDto> {
    const savedUser = await this.userRepository.findOneBy({ id: user.id });
    savedUser.nickname = dto.nickname.trim();
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
    const normalizedSubCode = dto.subCode.trim();
    if (!normalizedSubCode) {
      throw new BadRequestException('subCode must not be empty');
    }

    const duplicatedSubCodeUserInfo = await this.userInfoRepository.findOne({
      where: {
        subCode: normalizedSubCode,
      },
      relations: {
        user: true,
      },
    });

    if (
      duplicatedSubCodeUserInfo &&
      duplicatedSubCodeUserInfo.user.id !== user.id
    ) {
      throw new ConflictException('Your subCode already exists');
    }

    return await this.updateUserInfo(user.id, { subCode: normalizedSubCode });
  }

  async inquiry(user: UserEntity, dto: CreateInquiryRequestDto): Promise<void> {
    await this.profileInquiryRepository.save(
      this.profileInquiryRepository.create({
        content: dto.content.trim(),
        user,
      }),
    );
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

    return new ProfileResponseDto(savedUser, updatedUserInfo);
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
