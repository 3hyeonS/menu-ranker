import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { MenstrualRecordFieldsDto } from './menstrual-record-fields.dto';

export class CreateMenstrualRecordRequestDto extends MenstrualRecordFieldsDto {
  @ApiProperty({
    type: Number,
    description: '기록을 연결할 월경 회차 ID',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cycle_id: number;
}
