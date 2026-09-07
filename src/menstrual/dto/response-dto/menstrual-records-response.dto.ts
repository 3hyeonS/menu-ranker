import { ApiProperty } from '@nestjs/swagger';

export type MenstrualDateRange = { start_date: string; end_date: string };

export class MenstrualDateRangeResponseDto implements MenstrualDateRange {
  @ApiProperty({ type: String, example: '2026-08-02' })
  start_date: string;

  @ApiProperty({ type: String, example: '2026-08-04' })
  end_date: string;

  constructor(range: MenstrualDateRange) {
    this.start_date = range.start_date;
    this.end_date = range.end_date;
  }
}

export class MenstrualRecordsResponseDto {
  @ApiProperty({
    type: [MenstrualDateRangeResponseDto],
    description: '조회 기간과 겹치는 연속 월경 기록의 원본 전체 구간',
  })
  recorded_ranges: MenstrualDateRangeResponseDto[];

  @ApiProperty({
    type: Boolean,
    description: '조회 결과보다 오래된 월경 기록 존재 여부',
    example: true,
  })
  has_older: boolean;

  constructor(ranges: MenstrualDateRange[], hasOlder: boolean) {
    this.recorded_ranges = ranges.map(
      (range) => new MenstrualDateRangeResponseDto(range),
    );
    this.has_older = hasOlder;
  }
}
