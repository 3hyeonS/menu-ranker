import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export const MONTHLY_CALENDAR_MODES = [
  'intake',
  'workout',
  'weight',
  'water',
  '섭취',
  '운동',
  '몸무게',
  '물 섭취',
] as const;

export type MonthlyCalendarMode = (typeof MONTHLY_CALENDAR_MODES)[number];

export class MonthlyCalendarRequestDto {
  @ApiProperty({
    type: String,
    description: '조회 월(YYYY-MM)',
    example: '2026-09',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  date: string;

  @ApiProperty({
    enum: MONTHLY_CALENDAR_MODES,
    description:
      '조회 모드. intake(섭취), workout(운동), weight(몸무게), water(물 섭취)',
    example: 'intake',
  })
  @IsString()
  @IsIn(MONTHLY_CALENDAR_MODES)
  mode: MonthlyCalendarMode;
}
