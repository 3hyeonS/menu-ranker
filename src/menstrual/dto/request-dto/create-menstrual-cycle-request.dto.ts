import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  MENSTRUAL_FLOWS,
  MenstrualFlow,
} from '../../entity/menstrual-record.entity';
import { MenstrualDateRequestDto } from './menstrual-record-fields.dto';

export class CreateMenstrualCycleRequestDto extends MenstrualDateRequestDto {
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
    example: ['복통', '두통'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  symptoms?: string[] | null;
}
