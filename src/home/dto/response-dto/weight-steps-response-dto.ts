import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class WeightStepsResponseDto {
  @ApiProperty({
    type: Number,
    description: '체중 값',
    example: 57.6,
  })
  @IsOptional()
  weight: number = null;

  @ApiProperty({
    type: Number,
    description: '걸음 수',
    example: 1600,
  })
  @IsOptional()
  steps: number = null;

  constructor(weight: number, steps: number) {
    this.weight = weight;
    this.steps = steps;
  }
}
