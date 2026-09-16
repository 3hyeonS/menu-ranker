import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MonthlyCalendarResponseDto {
  @ApiProperty({
    type: String,
    description: '기록 날짜',
    example: '2026-09-17',
  })
  date: string;

  @ApiPropertyOptional({
    type: Number,
    description: '섭취 모드의 하루 총 칼로리(kcal)',
    example: 1542.3,
  })
  calories?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '운동 모드의 하루 총 소모 칼로리(kcal)',
    example: 350,
  })
  burned_calories?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '몸무게 모드의 기록 체중(kg)',
    example: 57.6,
  })
  weight?: number;

  @ApiPropertyOptional({
    type: Number,
    description: '물 섭취 모드의 하루 총 섭취량(ml)',
    example: 1200,
  })
  water_intake?: number;
}
