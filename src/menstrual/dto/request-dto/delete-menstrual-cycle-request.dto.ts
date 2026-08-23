import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class DeleteMenstrualCycleRequestDto {
  @ApiProperty({
    type: Number,
    description: '삭제할 월경 회차 ID',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cycle_id: number;
}
