import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class UpdateTargetCaloriesRequestDto {
  @ApiProperty({
    type: Number,
    description: '목표 칼로리',
    example: 1800,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(99999)
  target_calories: number;
}
