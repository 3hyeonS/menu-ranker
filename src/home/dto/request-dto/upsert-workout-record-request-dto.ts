import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

export class WorkoutSetRequestDto {
  @ApiProperty({
    type: Number,
    description: '세트 순서',
    example: 1,
  })
  @Type(() => Number)
  @IsNumber()
  set_order: number;

  @ApiProperty({
    type: Number,
    description: '중량',
    example: 40,
  })
  @Type(() => Number)
  @IsNumber(oneDecimalNumberOptions)
  weight: number;

  @ApiProperty({
    type: Number,
    description: '반복 횟수',
    example: 12,
  })
  @Type(() => Number)
  @IsNumber()
  reps: number;
}

export class UpsertWorkoutRecordRequestDto {
  @ApiProperty({
    type: String,
    description: '운동 기록 날짜',
    example: '2026-07-28',
  })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({
    type: Number,
    description: '운동 id',
    example: 1,
  })
  @Type(() => Number)
  @IsNumber()
  workout_id: number;

  @ApiProperty({
    type: Number,
    description: '운동 시간(분)',
    example: 30,
  })
  @Type(() => Number)
  @IsNumber(oneDecimalNumberOptions)
  @Min(0)
  workout_duration: number;

  @ApiProperty({
    type: Number,
    description: '소모 칼로리',
    example: 180,
  })
  @Type(() => Number)
  @IsNumber(oneDecimalNumberOptions)
  @Min(0)
  burned_calories: number;

  @ApiProperty({
    type: String,
    enum: ['cardio', 'weight'],
    description: '운동 유형',
    example: 'weight',
  })
  @IsIn(['cardio', 'weight'])
  workout_type: 'cardio' | 'weight';

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: '유산소 강도. 0: 낮음, 1: 보통, 2: 높음',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  intensity?: 0 | 1 | 2 | null;

  @ApiPropertyOptional({
    type: [WorkoutSetRequestDto],
    nullable: true,
    description: '근력 운동 세트 목록',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetRequestDto)
  set_list?: WorkoutSetRequestDto[] | null;
}
