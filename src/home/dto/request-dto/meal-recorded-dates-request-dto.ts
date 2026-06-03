import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class MealRecordedDatesRequestDto {
  @ApiProperty({
    type: String,
    description: '조회 시작일',
    example: '2026-03-01',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @ApiProperty({
    type: String,
    description: '조회 종료일',
    example: '2026-04-01',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;
}
