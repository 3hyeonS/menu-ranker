import { ApiProperty } from '@nestjs/swagger';

type NutritionLabelRecognitionInput = {
  unit: number;
  weight: number;
  calories: number;
  carbs: number | null;
  sugars: number | null;
  sugar_alchol: number | null;
  dietary_fiber: number | null;
  protein: number | null;
  fat: number | null;
  sat_fat: number | null;
  trans_fat: number | null;
  un_sat_fat: number | null;
  sodium: number | null;
  caffeine: number | null;
  potassium: number | null;
  cholesterol: number | null;
  alcohol: number | null;
};

export class NutritionLabelRecognitionResponseDto {
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
    type: Number,
    description: '칼로리(kcal)',
    example: 210,
  })
  calories: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '탄수화물(g)',
    example: 14,
  })
  carbs: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '당류(g)',
    example: 5,
  })
  sugars: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '당알코올(g)',
    example: 0,
  })
  sugar_alchol: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '식이섬유(g)',
    example: 3,
  })
  dietary_fiber: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '단백질(g)',
    example: 24,
  })
  protein: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '지방(g)',
    example: 7,
  })
  fat: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '포화지방(g)',
    example: 1.5,
  })
  sat_fat: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '트랜스지방(g)',
    example: 0,
  })
  trans_fat: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '불포화지방(g)',
    example: 5.5,
  })
  un_sat_fat: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '나트륨(mg)',
    example: 420,
  })
  sodium: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '카페인(mg)',
    example: 0,
  })
  caffeine: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '칼륨(mg)',
    example: 180,
  })
  potassium: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '콜레스테롤(mg)',
    example: 45,
  })
  cholesterol: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '알코올(g)',
    example: 0,
  })
  alcohol: number | null;

  constructor(value: NutritionLabelRecognitionInput) {
    Object.assign(this, value);
  }
}
