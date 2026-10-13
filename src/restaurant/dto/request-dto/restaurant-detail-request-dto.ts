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
    type: Number,
    nullable: true,
    description:
      '인증 없는 테스트용 사용자 ID. 생략하면 RESTAURANT_TEST_USER_ID를 사용하고, 둘 다 없으면 사용자 기록 없이 추천합니다.',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id?: number | null;

  @ApiPropertyOptional({
    enum: RestaurantMenuFilter,
    nullable: true,
    description: '추천 기준. null이면 사용자에게 전반적으로 적합한 메뉴를 추천합니다.',
    example: RestaurantMenuFilter.BALANCED,
  })
  @IsOptional()
  @IsEnum(RestaurantMenuFilter)
  filter?: RestaurantMenuFilter | null;
}
