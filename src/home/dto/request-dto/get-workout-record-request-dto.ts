import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class GetWorkoutRecordRequestDto {
  @ApiProperty({
    type: String,
    description: '조회할 날짜',
    example: '2026-07-28',
  })
  @IsNotEmpty()
  @IsDateString()
  date: string;
}
