import { ApiProperty } from '@nestjs/swagger';

export class ChatRecommendationBasisResponseDto {
  @ApiProperty({
    type: String,
    description: '사용자 목표',
    example: '감량',
  })
  goal: string;

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
    type: Number,
    description: '당일 누적 섭취 칼로리',
    example: 920.5,
  })
  consumed_calories: number;

  @ApiProperty({
    type: [Number],
    description: '당일 누적 탄수화물/단백질/지방 섭취량(g)',
    example: [110.2, 72.4, 31.1],
  })
  consumed_macros: number[];

  @ApiProperty({
    type: Number,
    description: '남은 목표 칼로리',
    example: 879.5,
  })
  remaining_calories: number;

  @ApiProperty({
    type: [Number],
    description: '남은 탄수화물/단백질/지방 목표량(g)',
    example: [92.3, 62.6, 18.9],
  })
  remaining_macros: number[];

  @ApiProperty({
    type: Number,
    description: '현재 추천 슬롯의 목표 칼로리',
    example: 430,
  })
  target_meal_calories: number;
}
