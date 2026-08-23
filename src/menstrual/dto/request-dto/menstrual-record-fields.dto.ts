import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  MENSTRUAL_FLOWS,
  MENSTRUAL_STATUSES,
  MenstrualFlow,
  MenstrualStatus,
} from '../../entity/menstrual-record.entity';

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class MenstrualDateRequestDto {
  @ApiProperty({
    type: String,
    description: '기록 또는 조회 날짜(YYYY-MM-DD)',
    example: '2026-08-17',
  })
  @IsString()
  @Matches(DATE_ONLY_PATTERN)
  date: string;
}

export class MenstrualRecordFieldsDto extends MenstrualDateRequestDto {
  @ApiProperty({
    enum: MENSTRUAL_STATUSES,
    description: '해당 날짜의 월경 유무',
    example: '있음',
  })
  @IsIn(MENSTRUAL_STATUSES)
  menstruation_status: MenstrualStatus;

  @ApiPropertyOptional({
    enum: MENSTRUAL_FLOWS,
    nullable: true,
    description: '월경 양',
    example: '보통',
  })
  @IsOptional()
  @IsIn(MENSTRUAL_FLOWS)
  flow?: MenstrualFlow | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    description: '복수 선택한 월경 증상',
    example: ['복통', '허리 통증'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  symptoms?: string[] | null;
}
