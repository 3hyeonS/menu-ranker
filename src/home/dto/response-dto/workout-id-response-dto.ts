import { ApiProperty } from '@nestjs/swagger';

export class WorkoutIdResponseDto {
  @ApiProperty({
    type: Number,
    description: '운동 id',
    example: 1,
  })
  workout_id: number;

  constructor(workoutId: number) {
    this.workout_id = workoutId;
  }
}
