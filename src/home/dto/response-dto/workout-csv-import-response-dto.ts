import { ApiProperty } from '@nestjs/swagger';

export class WorkoutCsvImportResponseDto {
  @ApiProperty({
    type: Number,
    description: 'CSV 데이터 행 수',
    example: 100,
  })
  total_count: number;

  @ApiProperty({
    type: Number,
    description: '새로 저장된 운동 수',
    example: 80,
  })
  inserted_count: number;

  @ApiProperty({
    type: Number,
    description: '기존 운동을 수정한 수',
    example: 15,
  })
  updated_count: number;

  @ApiProperty({
    type: Number,
    description: '저장하지 않고 건너뛴 행 수',
    example: 5,
  })
  skipped_count: number;

  @ApiProperty({
    type: Number,
    description: '저장 실패 행 수',
    example: 0,
  })
  failed_count: number;

  @ApiProperty({
    type: [String],
    description: '실패 사유 일부',
    example: [],
  })
  errors: string[];

  constructor(
    totalCount: number,
    insertedCount: number,
    updatedCount: number,
    skippedCount: number,
    failedCount: number,
    errors: string[] = [],
  ) {
    this.total_count = totalCount;
    this.inserted_count = insertedCount;
    this.updated_count = updatedCount;
    this.skipped_count = skippedCount;
    this.failed_count = failedCount;
    this.errors = errors;
  }
}
