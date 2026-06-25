import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

export class ChatNutritionLabelMenuRegisterRequestDto {
  @ApiProperty({
    type: String,
    description: '사용자가 입력한 메뉴명',
    example: '닭가슴살 소시지',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    description: '사용자가 입력한 브랜드명',
    example: '하림',
  })
  @IsNotEmpty()
  @IsString()
  brand: string;

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
    example: 100,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
  weight: number;

  @ApiProperty({
    type: Number,
    description: '칼로리(kcal)',
    example: 210,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
  calories: number;

  @ApiProperty({ type: Number, required: false, nullable: true, example: 14 })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  carbs: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: 5 })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  sugars: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: null })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  sugar_alchol: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: 3 })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  dietary_fiber: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: 24 })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  protein: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: 7 })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  fat: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: 1.5 })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  sat_fat: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: 0 })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  trans_fat: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: null })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  un_sat_fat: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: 420 })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  sodium: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: null })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  caffeine: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: null })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  potassium: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: 45 })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  cholesterol: number = null;

  @ApiProperty({ type: Number, required: false, nullable: true, example: null })
  @IsOptional()
  @IsNumber(oneDecimalNumberOptions)
  alcohol: number = null;
}
