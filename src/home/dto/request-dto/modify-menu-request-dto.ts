import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { MenuEntity } from '../../entity/menu.entity';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

export class ModifyMenuRequestDto {
  @ApiProperty({
    type: Number,
    description: '메뉴 id',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @ApiProperty({
    type: String,
    description: '메뉴명',
    example: '싸이버거',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    description: '브랜드',
    example: '맘스터치',
  })
  @IsOptional()
  @IsString()
  brand: string = null;

  @ApiProperty({
    type: Number,
    description: '중량 단위  \n0: g  \n1: ml',
    example: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  unit: number;

  @ApiProperty({
    type: Number,
    description: '중량(g/ml)',
    example: 230,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
  weight: number;

  @ApiProperty({
    type: Number,
    description: '칼로리(kcal)',
    example: 594,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
  calories: number;

  @ApiProperty({
    type: Number,
    description: '탄수화물(g)',
    example: 48,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  carbs: number = null;

  @ApiProperty({
    type: Number,
    description: '당류(g)',
    example: 7,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  sugars: number = null;

  @ApiProperty({
    type: Number,
    description: '당알코올(g)',
    example: 0,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  sugar_alchol: number = null;

  @ApiProperty({
    type: Number,
    description: '식이섬유(g)',
    example: 3,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  dietary_fiber: number = null;

  @ApiProperty({
    type: Number,
    description: '단백질(g)',
    example: 28,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  protein: number = null;

  @ApiProperty({
    type: Number,
    description: '지방(g)',
    example: 28,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  fat: number = null;

  @ApiProperty({
    type: Number,
    description: '포화지방(g)',
    example: 8,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  sat_fat: number = null;

  @ApiProperty({
    type: Number,
    description: '트랜스지방(g)',
    example: 0.5,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  trans_fat: number = null;

  @ApiProperty({
    type: Number,
    description: '불포화지방(g)',
    example: 19.5,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  un_sat_fat: number = null;

  @ApiProperty({
    type: Number,
    description: '나트륨(mg)',
    example: 950,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  sodium: number = null;

  @ApiProperty({
    type: Number,
    description: '카페인(mg)',
    example: 0,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  caffeine: number = null;

  @ApiProperty({
    type: Number,
    description: '칼륨(mg)',
    example: 320,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  potassium: number = null;

  @ApiProperty({
    type: Number,
    description: '콜레스테롤(mg)',
    example: 55,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  cholesterol: number = null;

  @ApiProperty({
    type: Number,
    description: '알코올(g)',
    example: 0,
  })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  alcohol: number = null;
}
