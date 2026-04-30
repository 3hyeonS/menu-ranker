import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';
import { oneDecimalNumberOptions } from '../../../../utils/number.util';

export class DefaltRatioRequestDto {
  @ApiProperty({
    type: Number,
    description: '목표 칼로리',
    example: 1487,
  })
  @IsNotEmpty()
  @IsNumber()
  target_calories: number;

  @ApiProperty({
    type: Number,
    description: '체중',
    example: 65,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
  weight: number;

  @ApiProperty({
    type: Number,
    description: '목표',
    example: 2,
  })
  @IsNotEmpty()
  @IsNumber()
  goal: number;

  @ApiProperty({
    type: Number,
    description: '목표 체중',
    example: 65,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
  target_weight: number;
}
