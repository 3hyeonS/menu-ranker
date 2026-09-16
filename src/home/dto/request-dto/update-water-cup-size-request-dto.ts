import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateWaterCupSizeRequestDto {
  @ApiProperty({
    type: Number,
    description: '컵 크기(ml)',
    minimum: 50,
    maximum: 1000,
    example: 250,
  })
  @IsInt()
  @Min(50)
  @Max(1000)
  cup_size: number;
}
