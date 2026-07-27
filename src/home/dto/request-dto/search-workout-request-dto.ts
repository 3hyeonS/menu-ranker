import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchWorkoutRequestDto {
  @ApiProperty({
    type: String,
    description: '검색어',
    example: '벤치프레스',
  })
  @IsString()
  input: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: '운동 부위 필터',
    example: '가슴',
  })
  @IsOptional()
  @IsString()
  body_parts?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: '운동 장비 필터',
    example: '덤벨',
  })
  @IsOptional()
  @IsString()
  equipments?: string | null;

  @ApiProperty({
    type: Number,
    description: '한 번에 조회할 운동 개수',
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
