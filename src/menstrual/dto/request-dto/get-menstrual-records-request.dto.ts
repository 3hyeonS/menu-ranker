import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { DATE_ONLY_PATTERN } from './menstrual-record-fields.dto';

export class GetMenstrualRecordsRequestDto {
  @ApiProperty({
    type: String,
    description: '조회 시작일(YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsString()
  @Matches(DATE_ONLY_PATTERN)
  from_date: string;

  @ApiProperty({
    type: String,
    description: '조회 종료일(YYYY-MM-DD)',
    example: '2026-09-01',
  })
  @IsString()
  @Matches(DATE_ONLY_PATTERN)
  to_date: string;
}
