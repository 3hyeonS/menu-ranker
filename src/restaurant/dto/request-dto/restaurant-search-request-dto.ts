import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RestaurantSearchRequestDto {
  @ApiProperty({
    type: String,
    description: '식당명(브랜드명) 검색어. 공백이면 전체 식당을 조회합니다.',
    example: '피자스쿨',
    maxLength: 300,
  })
  @IsString()
  @MaxLength(300)
  input: string;

  @ApiProperty({
    type: Number,
    description: '한 번에 조회할 식당 개수',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: '이전 응답의 next_cursor. 첫 조회 시 null 또는 생략합니다.',
    example: 1204,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursor?: number | null;
}
