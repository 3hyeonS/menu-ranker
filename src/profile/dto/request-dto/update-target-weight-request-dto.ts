import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

export class UpdateTargetWeightRequestDto {
  @ApiProperty({
    type: Number,
    description: '목표 체중',
    example: 60,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
  @Min(1)
  @Max(200)
  target_weight: number;
}
