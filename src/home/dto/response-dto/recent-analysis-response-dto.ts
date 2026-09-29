import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecentAnalysisResponseDto {
  @ApiProperty({
    type: String,
    description: '기록 날짜',
    example: '2026-09-29',
  })
  date: string;

  @ApiPropertyOptional({
    type: Number,
    description: '하루 섭취 칼로리(kcal)',
    example: 1568.2,
  })
  intake_calories?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '기록 체중(kg)',
    example: 57.4,
  })
  weight?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '걸음과 운동을 합산한 하루 총 소모 칼로리(kcal)',
    example: 420.5,
  })
  total_burned_calories?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '기록된 걸음 수를 기준으로 추정한 소모 칼로리(kcal)',
    example: 170.5,
  })
  steps_burned_calories?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '기록된 운동으로 소모한 칼로리(kcal)',
    example: 250,
  })
  workout_burned_calories?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '섭취 칼로리 - (기초대사량 + 걸음·운동 소모 칼로리)(kcal)',
    example: -320.8,
  })
  calorie_deficit?: number;
}
