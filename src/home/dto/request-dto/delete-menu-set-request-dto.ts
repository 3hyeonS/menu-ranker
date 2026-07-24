import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class DeleteMenuSetRequestDto {
  @ApiProperty({
    type: Number,
    description: '삭제할 세트 id',
    example: 1,
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  set_id: number;
}
