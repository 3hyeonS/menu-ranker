import { ApiProperty } from '@nestjs/swagger';
import { MenuEntity } from '../../entity/menu.entity';

export class MenuResponseDto {
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
    type: Number,
    description: '삭제 여부  \n0: 미삭제  \n1: 삭제',
    example: 0,
  })
  is_deleted: number;

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
  category: string = null;

  @ApiProperty({
    type: Number,
    description: '중량 단위  \n0: g  \n1: ml',
    example: 0,
  })
  unit: number;

  @ApiProperty({
    type: Number,
    description: '중량(g/ml)',
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
    description: '칼로리(kcal)',
    example: 594,
  })
  calories: number;

  @ApiProperty({
    type: Number,
    description: '탄수화물(g)',
    example: 48,
  })
  carbs: number = null;

  @ApiProperty({
    type: Number,
    description: '당류(g)',
    example: 7,
  })
  sugars: number = null;

  @ApiProperty({
    type: Number,
    description: '당알코올(g)',
    example: 0,
  })
  sugar_alchol: number = null;

  @ApiProperty({
    type: Number,
    description: '식이섬유(g)',
    example: 3,
  })
  dietary_fiber: number = null;

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
    description: '포화지방(g)',
    example: 8,
  })
  sat_fat: number = null;

  @ApiProperty({
    type: Number,
    description: '트랜스지방(g)',
    example: 0.5,
  })
  trans_fat: number = null;

  @ApiProperty({
    type: Number,
    description: '불포화지방(g)',
    example: 19.5,
  })
  un_sat_fat: number = null;

  @ApiProperty({
    type: Number,
    description: '나트륨(mg)',
    example: 950,
  })
  sodium: number = null;

  @ApiProperty({
    type: Number,
    description: '카페인(mg)',
    example: 0,
  })
  caffeine: number = null;

  @ApiProperty({
    type: Number,
    description: '칼륨(mg)',
    example: 320,
  })
  potassium: number = null;

  @ApiProperty({
    type: Number,
    description: '콜레스테롤(mg)',
    example: 55,
  })
  cholesterol: number = null;

  @ApiProperty({
    type: Number,
    description: '알코올(g)',
    example: 0,
  })
  alcohol: number = null;

  constructor(menu: MenuEntity) {
    this.id = menu.id;
    this.data_source = menu.data_source;
    this.is_deleted = menu.is_deleted;
    this.name = menu.name;
    this.brand = menu.brand;
    this.category = menu.category;
    this.unit = menu.unit;
    this.weight = menu.weight;
    this.unit_quantity = menu.unit_quantity;
    this.calories = menu.calories;
    this.carbs = menu.carbs;
    this.sugars = menu.sugars;
    this.sugar_alchol = menu.sugar_alchol;
    this.dietary_fiber = menu.dietary_fiber;
    this.protein = menu.protein;
    this.fat = menu.fat;
    this.sat_fat = menu.sat_fat;
    this.trans_fat = menu.trans_fat;
    this.un_sat_fat = menu.un_sat_fat;
    this.sodium = menu.sodium;
    this.caffeine = menu.caffeine;
    this.potassium = menu.potassium;
    this.cholesterol = menu.cholesterol;
    this.alcohol = menu.alcohol;
  }
}
