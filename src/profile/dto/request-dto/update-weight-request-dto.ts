import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

export class UpdateWeightRequestDto {
  @ApiProperty({
    type: Number,
    description: '현재 체중',
    example: 65,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
  @Min(1)
  @Max(200)
  weight: number;
}
