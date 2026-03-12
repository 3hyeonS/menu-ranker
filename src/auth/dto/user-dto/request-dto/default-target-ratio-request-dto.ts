import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class DefaltRatioRequestDto {
  @ApiProperty({
    type: Number,
    description: '목표 칼로리',
    example: 1487,
  })
  @IsNotEmpty()
  @IsNumber()
  targetCalories: number;

  @ApiProperty({
    type: Number,
    description: '체중',
    example: 65,
  })
  @IsNotEmpty()
  @IsNumber()
  weight: number;

  @ApiProperty({
    type: Number,
    description: '목표',
    example: 2,
  })
  @IsNotEmpty()
  @IsNumber()
  goal: number;
}
