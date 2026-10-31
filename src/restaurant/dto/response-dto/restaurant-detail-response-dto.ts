import { ApiProperty } from '@nestjs/swagger';

export class RestaurantMenuResponseDto {
  @ApiProperty({ type: Number, description: '메뉴 ID', example: 20123 })
  menu_id: number;

  @ApiProperty({ type: String, description: '음식명', example: '고구마 피자' })
  menu_name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '메뉴 세부 카테고리(음식 카드 뱃지). 없으면 null',
    example: '피자',
  })
  menu_category: string | null;

  @ApiProperty({ type: Number, description: '칼로리(kcal)', example: 258 })
  calories: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '당류(g)',
    example: 6.2,
  })
  sugars: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '단백질(g)',
    example: 12.3,
  })
  protein: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '포화지방(g)',
    example: 3.1,
  })
  sat_fat: number | null;

  @ApiProperty({
    type: Number,
    description: '중량 단위. 0은 g, 1은 ml',
    example: 0,
  })
  unit: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '중량',
    example: 100,
  })
  weight: number | null;

  @ApiProperty({
    type: String,
    description: '단위량(인분, 조각, 잔, 기준량 등)',
    example: '조각',
  })
  unit_quantity: string;
}

export class RestaurantDetailResponseDto {
  @ApiProperty({
    type: String,
    description: '식당명(브랜드명)',
    example: '피자스쿨',
  })
  restaurant_name: string;

  @ApiProperty({ type: [RestaurantMenuResponseDto] })
  menu_list: RestaurantMenuResponseDto[];
}
