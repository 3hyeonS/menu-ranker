import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class MenuSetDetailRequestDto {
  @ApiProperty({
    type: Number,
    description: '세트 id',
    example: 1,
  })
  @Type(() => Number)
  @IsNumber()
  set_id: number;
}
