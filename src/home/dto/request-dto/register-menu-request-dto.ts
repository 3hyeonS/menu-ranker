import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { MenuEntity } from '../../entity/menu.entity';

export class RegisterMenuRequestDto {
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
  @IsNumber()
  weight: number;

  @ApiProperty({
    type: Number,
    description: '칼로리(kcal)',
    example: 594,
  })
  @IsNotEmpty()
  @IsNumber()
  calories: number;

  @ApiProperty({
    type: Number,
    description: '탄수화물(g)',
    example: 48,
  })
  @IsOptional()
  @IsNumber()
  carbs: number = null;

  @ApiProperty({
    type: Number,
    description: '당류(g)',
    example: 7,
  })
  @IsOptional()
  @IsNumber()
  sugars: number = null;

  @ApiProperty({
    type: Number,
    description: '당알코올(g)',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  sugar_alchol: number = null;

  @ApiProperty({
    type: Number,
    description: '식이섬유(g)',
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  dietary_fiber: number = null;

  @ApiProperty({
    type: Number,
    description: '단백질(g)',
    example: 28,
  })
  @IsOptional()
  @IsNumber()
  protein: number = null;

  @ApiProperty({
    type: Number,
    description: '지방(g)',
    example: 28,
  })
  @IsOptional()
  @IsNumber()
  fat: number = null;

  @ApiProperty({
    type: Number,
    description: '포화지방(g)',
    example: 8,
  })
  @IsOptional()
  @IsNumber()
  sat_fat: number = null;

  @ApiProperty({
    type: Number,
    description: '트랜스지방(g)',
    example: 0.5,
  })
  @IsOptional()
  @IsNumber()
  trans_fat: number = null;

  @ApiProperty({
    type: Number,
    description: '불포화지방(g)',
    example: 19.5,
  })
  @IsOptional()
  @IsNumber()
  un_sat_fat: number = null;

  @ApiProperty({
    type: Number,
    description: '나트륨(mg)',
    example: 950,
  })
  @IsOptional()
  @IsNumber()
  sodium: number = null;

  @ApiProperty({
    type: Number,
    description: '카페인(mg)',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  caffeine: number = null;

  @ApiProperty({
    type: Number,
    description: '칼륨(mg)',
    example: 320,
  })
  @IsOptional()
  @IsNumber()
  potassium: number = null;

  @ApiProperty({
    type: Number,
    description: '콜레스테롤(mg)',
    example: 55,
  })
  @IsOptional()
  @IsNumber()
  cholesterol: number = null;

  @ApiProperty({
    type: Number,
    description: '알코올(g)',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  alcohol: number = null;
}
