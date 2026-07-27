import { ApiProperty } from '@nestjs/swagger';

export class WorkoutDetailResponseDto {
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
    description: '운동 gif',
    example: 'https://example.com/workout.gif',
  })
  workout_gif: string | null;

  @ApiProperty({
    type: String,
    enum: ['cardio', 'weight'],
    description: '운동 유형',
    example: 'weight',
  })
  workout_type: 'cardio' | 'weight';

  @ApiProperty({
    type: String,
    nullable: true,
    description: '운동 장비',
    example: '덤벨',
  })
  equipments: string | null;

  @ApiProperty({
    type: [String],
    description: '운동 부위 목록',
    example: ['가슴', '삼두'],
  })
  body_parts: string[];
}
