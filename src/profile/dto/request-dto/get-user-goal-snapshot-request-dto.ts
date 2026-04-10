import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty } from 'class-validator';

export class GetUserGoalSnapshotRequestDto {
  @ApiProperty({
    type: Date,
    description: '조회 기준 날짜',
    example: '2026-04-10',
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  date: Date;
}
