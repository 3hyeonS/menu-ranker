import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

export class UpsertMenuSetRequestDto {
  @ApiPropertyOptional({
    type: Number,
    description: '수정할 세트 id. 미입력 시 새 세트 생성',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  set_id?: number;

  @ApiProperty({
    type: String,
    description: '세트명',
    example: '단백질 쉐이크',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  set_name: string;

  @ApiProperty({
    type: [Number],
    description: '메뉴 id 목록',
    example: [1, 2],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  menu_ids: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 중량',
    example: [30, 100],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsNumber(oneDecimalNumberOptions, { each: true })
  menu_quantities: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 입력 방식  \n0: 단위 탭  \n1: 중량 탭',
    example: [1, 1],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  @IsIn([0, 1], {
    each: true,
    message: 'each value in menu_input_modes must be 0 or 1',
  })
  menu_input_modes: number[];
}
