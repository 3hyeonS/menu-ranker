import { ApiProperty } from '@nestjs/swagger';
import { MenstrualCycleEntity } from '../../entity/menstrual-cycle.entity';

export class MenstrualCycleItemResponseDto {
  @ApiProperty({ type: Number, example: 1 })
  cycle_id: number;

  @ApiProperty({ type: String, example: '2026-08-17' })
  start_date: string;

  @ApiProperty({ type: String, example: '2026-08-19' })
  end_date: string;

  @ApiProperty({ type: Boolean, example: true })
  is_end: boolean;

  constructor(cycle: MenstrualCycleEntity) {
    this.cycle_id = cycle.id;
    this.start_date = cycle.startDate;
    this.end_date = cycle.endDate;
    this.is_end = cycle.isEnd;
  }
}

export class MenstrualCycleResponseDto {
  @ApiProperty({ type: MenstrualCycleItemResponseDto })
  cycle: MenstrualCycleItemResponseDto;

  constructor(cycle: MenstrualCycleEntity) {
    this.cycle = new MenstrualCycleItemResponseDto(cycle);
  }
}

export class MenstrualCyclesResponseDto {
  @ApiProperty({ type: [MenstrualCycleItemResponseDto] })
  cycles: MenstrualCycleItemResponseDto[];

  constructor(cycles: MenstrualCycleEntity[]) {
    this.cycles = cycles.map(
      (cycle) => new MenstrualCycleItemResponseDto(cycle),
    );
  }
}
