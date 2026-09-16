import { ApiProperty } from '@nestjs/swagger';

export class WaterIntakeResponseDto {
  @ApiProperty({
    type: Number,
    description: '설정한 컵 크기(ml). 설정값이 없으면 100ml',
    example: 250,
  })
  cup_size: number;

  @ApiProperty({
    type: Number,
    description: '해당 날짜의 총 물 섭취량(ml)',
    example: 1200,
  })
  water_intake: number;

  constructor(cupSize: number, waterIntake: number) {
    this.cup_size = cupSize;
    this.water_intake = waterIntake;
  }
}
