import { ApiProperty } from '@nestjs/swagger';

// 메뉴 영양정보 출처(#45). 출처 종류가 늘어도 계약을 다시 바꾸지 않도록 boolean 대신 문자열 enum으로 둔다.
export enum RestaurantMenuNutritionSource {
  /** 브랜드 식당 공식 영양정보(restaurant_menu) */
  OFFICIAL = 'official',
  /** 개인 식당 추정값(restaurant_menu_nutrition_estimate). 식약처 값을 그대로 쓴 메뉴(source=mfds)도 포함한다. */
  ESTIMATED = 'estimated',
}

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

  @ApiProperty({
    enum: RestaurantMenuNutritionSource,
    description:
      '영양정보 출처. official은 브랜드 공식 영양정보, estimated는 개인 식당 메뉴의 추정값(식약처 값을 그대로 쓴 메뉴 포함)입니다. 항상 값이 있습니다.',
    example: RestaurantMenuNutritionSource.OFFICIAL,
  })
  nutrition_source: RestaurantMenuNutritionSource;
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
