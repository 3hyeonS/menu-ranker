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
    description:
      '운동 부위 대분류 필터. 유산소, 가슴, 등, 하체, 어깨, 팔, 코어 중 하나',
    example: '가슴',
  })
  @IsOptional()
  @IsString()
  body_part_major?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      '운동 부위 소분류 필터. 허벅지, 종아리, 상완, 전완, 복부, 허리, 목 등',
    example: '허벅지',
  })
  @IsOptional()
  @IsString()
  body_part_minor?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      '운동 기구 대분류. 바벨, 덤벨, 케틀벨, 밴드, 머신, 스미스 머신, 맨몸, 폼롤러, 케이블 머신, 기타 중 하나',
    example: '덤벨',
  })
  @IsOptional()
  @IsString()
  equipment_category?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: '기구 상세 분류. 머신 또는 기타 기구의 세부 이름',
    example: '레그 프레스 머신',
  })
  @IsOptional()
  @IsString()
  equipment_detail?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: '원본 운동 데이터의 기구명',
    example: 'lever sled 45 degree leg press',
  })
  @IsOptional()
  @IsString()
  equipment_original_detail?: string | null;

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
