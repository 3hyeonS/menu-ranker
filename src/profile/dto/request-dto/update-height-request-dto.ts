import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

export class UpdateHeightRequestDto {
  @ApiProperty({
    type: Number,
    description: '신장',
    example: 170,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
  @Min(1)
  @Max(250)
  height: number;
}
