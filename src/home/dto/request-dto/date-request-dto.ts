import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty } from 'class-validator';

export class DateRequestDto {
  @ApiProperty({
    type: Date,
    description: '날짜',
    example: '2026-03-17',
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  date: Date;
}
