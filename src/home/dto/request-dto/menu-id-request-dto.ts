import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class MenuIdRequestDto {
  @ApiProperty({
    type: Number,
    description: '메뉴 id',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  id: number;
}
