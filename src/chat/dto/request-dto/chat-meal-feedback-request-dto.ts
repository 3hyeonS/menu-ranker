import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ChatMealFeedbackRequestDto {
  @ApiProperty({
    type: String,
    description: '식사 피드백을 받을 캘린더 선택 날짜 (YYYY-MM-DD)',
    example: '2026-09-12',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;
}
