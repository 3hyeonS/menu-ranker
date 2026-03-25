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
    example: '1인분',
  })
  unit_quantity: string;

  @ApiProperty({
    type: Number,
    description: '칼로리(g)',
    example: 594,
  })
  calories: number = null;

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
  }
}
