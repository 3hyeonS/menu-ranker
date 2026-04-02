import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../../auth/entity/user/user.entity';
import { UserInfoEntity } from '../../../auth/entity/user/userInfo.entity';

export class ProfileResponseDto {
  @ApiProperty({ example: '홍길동' })
  nickname: string;

  @ApiProperty({
    enum: [0, 1],
    description: '성별 (0: 남성, 1: 여성)',
    example: 0,
  })
  gender: number;

  @ApiProperty({
    type: Number,
    description: '출생년도',
    example: 1999,
  })
  birthYear: number;

  @ApiProperty({
    type: Number,
    description: '신장',
    example: 170,
  })
  height: number;

  @ApiProperty({
    type: Number,
    description: '현재 체중',
    example: 65,
  })
  weight: number;

  @ApiProperty({
    enum: [0, 1, 2, 3],
    description: '활동량',
    example: 1,
  })
  activity: number;

  @ApiProperty({
    enum: [0, 1, 2],
    description: '목표',
    example: 0,
  })
  goal: number;

  @ApiProperty({
    type: Number,
    description: '목표 체중',
    example: 60,
  })
  target_weight: number;

  @ApiProperty({
    type: Number,
    description: '목표 칼로리',
    example: 1800,
  })
  target_calories: number;

  @ApiProperty({
    type: [Number],
    description: '목표 탄단지 비율',
    example: [45, 30, 25],
  })
  target_ratio: number[];

  constructor(user: UserEntity, userInfo: UserInfoEntity) {
    this.nickname = user.nickname;
    this.gender = userInfo.gender;
    this.birthYear = userInfo.birthYear;
    this.height = userInfo.height;
    this.weight = userInfo.weight;
    this.activity = userInfo.activity;
    this.goal = userInfo.goal;
    this.target_weight = userInfo.target_weight;
    this.target_calories = userInfo.target_calories;
    this.target_ratio = userInfo.target_ratio;
  }
}
