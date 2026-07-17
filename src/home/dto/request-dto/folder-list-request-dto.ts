import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class FolderListRequestDto {
  @ApiProperty({
    type: Number,
    description: '한 번에 조회할 폴더 개수',
    example: 20,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: '이전 응답의 next_cursor. 첫 조회 시 생략',
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cursor?: number | null;
}
