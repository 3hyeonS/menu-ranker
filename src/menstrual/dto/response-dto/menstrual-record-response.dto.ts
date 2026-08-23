import { ApiProperty } from '@nestjs/swagger';
import {
  MENSTRUAL_FLOWS,
  MENSTRUAL_STATUSES,
  MenstrualFlow,
  MenstrualRecordEntity,
  MenstrualStatus,
} from '../../entity/menstrual-record.entity';

export class MenstrualRecordItemResponseDto {
  @ApiProperty({ type: String, example: '2026-08-19' })
  date: string;

  @ApiProperty({ enum: MENSTRUAL_STATUSES, example: '있음' })
  menstruation_status: MenstrualStatus;

  @ApiProperty({ enum: MENSTRUAL_FLOWS, nullable: true, example: '보통' })
  flow: MenstrualFlow | null;

  @ApiProperty({
    type: [String],
    nullable: true,
    example: ['복통', '허리 통증'],
  })
  symptoms: string[] | null;

  @ApiProperty({ type: Number, example: 1 })
  cycle_id: number;

  constructor(record: MenstrualRecordEntity) {
    this.date = record.date;
    this.menstruation_status = record.menstruationStatus;
    this.flow = record.flow;
    this.symptoms = record.symptoms;
    this.cycle_id = record.cycle.id;
  }
}

export class MenstrualRecordResponseDto {
  @ApiProperty({
    type: MenstrualRecordItemResponseDto,
    nullable: true,
    description: '직접 저장한 기록이 없으면 null',
  })
  record: MenstrualRecordItemResponseDto | null;

  constructor(record: MenstrualRecordEntity | null) {
    this.record = record ? new MenstrualRecordItemResponseDto(record) : null;
  }
}
