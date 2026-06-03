import { ApiProperty } from '@nestjs/swagger';

export class MealRecordedDatesResponseDto {
  @ApiProperty({
    name: 'recorded-dates',
    type: [String],
    description: '식사 기록이 있는 날짜 목록',
    example: ['2026-03-06', '2026-03-07', '2026-03-09'],
  })
  'recorded-dates': string[];

  constructor(recordedDates: string[]) {
    this['recorded-dates'] = recordedDates;
  }
}
