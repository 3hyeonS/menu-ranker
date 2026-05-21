import { ApiProperty } from '@nestjs/swagger';
import { MenuEntity } from '../../entity/menu.entity';

export class MenuSimpleResponseDto {
  @ApiProperty({
    type: Number,
    description: 'id',
    example: 1,
  })
  id: number;

  @ApiProperty({
    type: Number,
    description: '데이터 분류  \n0: 공용  \n1: 개인용',
    example: 0,
  })
  data_source: number;

  @ApiProperty({
    type: String,
    description: '메뉴명',
    example: '싸이버거',
  })
  name: string;

  @ApiProperty({
    type: String,
    description: '브랜드',
    example: '맘스터치',
  })
  brand: string = null;

  @ApiProperty({
    type: String,
    description: '카테고리',
    example: '버거류',
  })
  category: string;

  @ApiProperty({
    type: Number,
    description: '중량 단위  \n0: g  \n1: ml',
    example: 0,
  })
  unit: number;

  @ApiProperty({
    type: Number,
    description: '중량',
    example: 230,
  })
  weight: number;

  @ApiProperty({
    type: String,
    description: '단위량',
    example: '인분',
  })
  unit_quantity: string;

  @ApiProperty({
    type: Number,
    description: '칼로리(g)',
    example: 594,
  })
  calories: number = null;

  @ApiProperty({
    type: Number,
    description: '탄수화물(g)',
    example: 48,
  })
  carbs: number = null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: '탄수화물이 0 또는 null인 경우 함께 반환되는 당류(g)',
    example: 7,
  })
  sugars?: number = null;

  @ApiProperty({
    type: Number,
    description: '단백질(g)',
    example: 28,
  })
  protein: number = null;

  @ApiProperty({
    type: Number,
    description: '지방(g)',
    example: 28,
  })
  fat: number = null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: '지방이 0 또는 null인 경우 함께 반환되는 포화지방(g)',
    example: 8,
  })
  sat_fat?: number = null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: '지방이 0 또는 null인 경우 함께 반환되는 트랜스지방(g)',
    example: 0.5,
  })
  trans_fat?: number = null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: '지방이 0 또는 null인 경우 함께 반환되는 불포화지방(g)',
    example: 19.5,
  })
  un_sat_fat?: number = null;

  constructor(menu: MenuEntity) {
    this.id = menu.id;
    this.data_source = menu.data_source;
    this.name = menu.name;
    this.brand = menu.brand;
    this.category = menu.category;
    this.unit = menu.unit;
    this.weight = menu.weight;
    this.unit_quantity = menu.unit_quantity;
    this.calories = menu.calories;
    this.carbs = menu.carbs;
    this.protein = menu.protein;
    this.fat = menu.fat;
    this.assignFallbackNutritionDetails(menu);
  }

  private assignFallbackNutritionDetails(menu: MenuEntity): void {
    if (menu.carbs === null || menu.carbs === undefined || menu.carbs === 0) {
      this.sugars = menu.sugars;
    }

    if (menu.fat === null || menu.fat === undefined || menu.fat === 0) {
      this.sat_fat = menu.sat_fat;
      this.trans_fat = menu.trans_fat;
      this.un_sat_fat = menu.un_sat_fat;
    }
  }
}
