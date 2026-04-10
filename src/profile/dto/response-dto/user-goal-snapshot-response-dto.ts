import { ApiProperty } from '@nestjs/swagger';
import { UserGoalEntity } from '../../../auth/entity/user/userGoal.entity';

export class UserGoalSnapshotResponseDto {
  @ApiProperty({
    type: Number,
    description: '스냅샷 id',
    example: 12,
  })
  id: number;

  @ApiProperty({
    type: Number,
    description: '활동량',
    example: 1,
  })
  activity: number;

  @ApiProperty({
    type: Number,
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

  @ApiProperty({
    type: String,
    description: '스냅샷 생성 시각',
    example: '2026-04-10T08:15:00.000Z',
  })
  createdAt: Date;

  constructor(userGoal: UserGoalEntity) {
    this.id = userGoal.id;
    this.activity = userGoal.activity;
    this.goal = userGoal.goal;
    this.target_weight = userGoal.target_weight;
    this.target_calories = userGoal.target_calories;
    this.target_ratio = userGoal.target_ratio;
    this.createdAt = userGoal.createdAt;
  }
}
