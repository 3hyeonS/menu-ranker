import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MenstrualDateRequestDto } from './menstrual-record-fields.dto';

export class GetMenstrualCyclesRequestDto extends MenstrualDateRequestDto {
  @ApiPropertyOptional({
    type: Number,
    default: 7,
    minimum: 1,
    maximum: 50,
    description: '조회할 최대 회차 수',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 7;
}
