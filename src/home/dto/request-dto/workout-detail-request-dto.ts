import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class WorkoutDetailRequestDto {
  @ApiProperty({
    type: Number,
    description: '운동 id',
    example: 1,
  })
  @Type(() => Number)
  @IsNumber()
  workout_id: number;
}
