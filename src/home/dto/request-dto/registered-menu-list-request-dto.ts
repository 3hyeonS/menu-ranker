import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RegisteredMenuListRequestDto {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      '한 번에 조회할 메뉴 개수. 생략하면 기존 방식처럼 전체 메뉴를 반환합니다.',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: '이전 응답의 next_cursor. 첫 조회 시 생략합니다.',
    example: 512,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursor?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: '메뉴명 검색어. 생략하거나 공백이면 전체를 조회합니다.',
    example: '닭가슴살',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  input?: string | null;
}
