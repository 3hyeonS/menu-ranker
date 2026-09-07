import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DATE_ONLY_PATTERN } from './menstrual-record-fields.dto';

export class MenstrualDateRangeRequestDto {
  @ApiProperty({ type: String, example: '2026-08-02' })
  @IsString()
  @Matches(DATE_ONLY_PATTERN)
  start_date: string;

  @ApiProperty({ type: String, example: '2026-08-04' })
  @IsString()
  @Matches(DATE_ONLY_PATTERN)
  end_date: string;
}

export class SaveMenstrualRecordsRequestDto {
  @ApiProperty({
    type: [MenstrualDateRangeRequestDto],
    description: '추가할 월경 기록 구간',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MenstrualDateRangeRequestDto)
  add_ranges: MenstrualDateRangeRequestDto[];

  @ApiProperty({
    type: [MenstrualDateRangeRequestDto],
    description: '삭제할 월경 기록 구간',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MenstrualDateRangeRequestDto)
  remove_ranges: MenstrualDateRangeRequestDto[];
}
