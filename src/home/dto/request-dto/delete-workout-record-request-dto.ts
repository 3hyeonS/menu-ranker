import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class DeleteWorkoutRecordRequestDto {
  @ApiProperty({
    type: String,
    description: '삭제할 날짜',
    example: '2026-07-28',
  })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '삭제할 운동 id. null이면 해당 날짜 전체 운동 기록 삭제',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  workout_id?: number | null;
}
