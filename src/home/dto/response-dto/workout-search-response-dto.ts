import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class WorkoutSearchItemResponseDto {
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

  @ApiProperty({
    type: String,
    enum: ['cardio', 'weight'],
    description: '운동 유형',
    example: 'weight',
  })
  workout_type: 'cardio' | 'weight';
}

export class WorkoutSearchResponseDto {
  @ValidateNested({ each: true })
  @ApiProperty({
    type: [WorkoutSearchItemResponseDto],
    description: '운동 검색 결과',
  })
  @Type(() => WorkoutSearchItemResponseDto)
  workout_list: WorkoutSearchItemResponseDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '다음 페이지 조회 cursor. 더 없으면 null',
    example: 10,
  })
  next_cursor: number | null;

  constructor(
    workoutList: WorkoutSearchItemResponseDto[],
    nextCursor: number | null,
  ) {
    this.workout_list = workoutList;
    this.next_cursor = nextCursor;
  }
}
