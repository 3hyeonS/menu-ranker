import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class WorkoutRecordSetResponseDto {
  @ApiProperty({ type: Number, description: '세트 순서', example: 1 })
  set_order: number;

  @ApiProperty({ type: Number, description: '중량', example: 40 })
  weight: number;

  @ApiProperty({ type: Number, description: '반복 횟수', example: 12 })
  reps: number;
}

export class WorkoutRecordItemResponseDto {
  @ApiProperty({ type: Number, description: '운동 id', example: 1 })
  workout_id: number;

  @ApiProperty({
    type: String,
    description: '운동명',
    example: '벤치프레스',
  })
  workout_name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '운동 이미지',
    example: 'https://example.com/workout.png',
  })
  workout_image: string | null;

  @ApiProperty({ type: Number, description: '운동 시간(분)', example: 30 })
  workout_duration: number;

  @ApiProperty({ type: Number, description: '소모 칼로리', example: 180 })
  burned_calories: number;

  @ApiProperty({
    type: String,
    enum: ['cardio', 'weight'],
    description: '운동 유형',
    example: 'weight',
  })
  workout_type: 'cardio' | 'weight';

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '유산소 강도. 0: 낮음, 1: 보통, 2: 높음',
    example: 1,
  })
  intensity: 0 | 1 | 2 | null;

  @ValidateNested({ each: true })
  @ApiProperty({
    type: [WorkoutRecordSetResponseDto],
    nullable: true,
    description: '근력 운동 세트 목록',
  })
  @Type(() => WorkoutRecordSetResponseDto)
  set_list: WorkoutRecordSetResponseDto[] | null;
}

export class WorkoutRecordResponseDto {
  @ValidateNested({ each: true })
  @ApiProperty({
    type: [WorkoutRecordItemResponseDto],
    description: '운동 기록 목록',
  })
  @Type(() => WorkoutRecordItemResponseDto)
  workout_list: WorkoutRecordItemResponseDto[];

  constructor(workoutList: WorkoutRecordItemResponseDto[]) {
    this.workout_list = workoutList;
  }
}
