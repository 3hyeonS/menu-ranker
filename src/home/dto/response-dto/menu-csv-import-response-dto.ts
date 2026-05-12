import { ApiProperty } from '@nestjs/swagger';

export class MenuCsvImportResponseDto {
  @ApiProperty({
    type: Number,
    description: '저장된 메뉴 수',
    example: 10,
  })
  saved_count: number;

  constructor(savedCount: number) {
    this.saved_count = savedCount;
  }
}
