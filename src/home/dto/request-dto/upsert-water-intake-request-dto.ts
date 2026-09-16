import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpsertWaterIntakeRequestDto {
  @ApiProperty({
    type: String,
    description: '기록 날짜(YYYY-MM-DD)',
    example: '2026-09-17',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiProperty({
    type: Number,
    description: '해당 날짜의 총 물 섭취량(ml). 0이면 기록을 초기화합니다.',
    minimum: 0,
    maximum: 10000,
    example: 1200,
  })
  @IsInt()
  @Min(0)
  @Max(10000)
  water_intake: number;
}
