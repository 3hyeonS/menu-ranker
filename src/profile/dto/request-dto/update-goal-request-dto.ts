import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateGoalRequestDto {
  @ApiProperty({
    enum: [0, 1, 2],
    description: '목표(리스트 순서대로 0, 1, 2)',
    example: 2,
  })
  @IsNotEmpty()
  @IsIn([0, 1, 2])
  goal: number;
}
