import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class WaterDateRequestDto {
  @ApiProperty({
    type: String,
    description: '조회 날짜(YYYY-MM-DD)',
    example: '2026-09-17',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}
