import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum RestaurantMenuFilter {
  BALANCED = '균형',
  LOW_CALORIE = '저칼로리',
  PROTEIN = '단백질',
}

export class RestaurantDetailRequestDto {
  @ApiProperty({
    type: Number,
    description: '식당 검색 API에서 받은 식당 ID',
    example: 1204,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  restaurant_id: number;

  @ApiPropertyOptional({
    enum: RestaurantMenuFilter,
    nullable: true,
    description:
      '추천 기준. null 또는 생략 시 해당 식당의 전체 메뉴를 반환합니다.',
    example: RestaurantMenuFilter.BALANCED,
  })
  @IsOptional()
  @IsEnum(RestaurantMenuFilter)
  filter?: RestaurantMenuFilter | null;
}
