import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Matches,
  IsString,
  ValidateIf,
} from 'class-validator';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

export class RegisterMealRequestDto {
  @ApiProperty({
    type: Date,
    description: '날짜',
    example: '2026-03-17',
  })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  date: Date;

  @ApiProperty({
    type: Number,
    description: '끼니  \n0:아침  \n1: 점심  \n2:저녁  \n3: 간식  \n4:야식',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @IsIn([0, 1, 2, 3, 4], { message: 'current must be 0, 1, 2, 3 or 4' })
  time: number;

  @ApiPropertyOptional({
    type: String,
    description: '실제 식사 시각. HH:mm 형식. 미입력 시 기존 값 유지 또는 null',
    example: '12:30',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'meal_time must be in HH:mm format',
  })
  meal_time?: string;

  @ApiProperty({
    type: String,
    description: '이미지 파일 url',
    example: 'imageUrl',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    type: [Number],
    description: '메뉴 id. 안 먹었어요 등록 시 생략',
    example: [1, 2],
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true }) // 배열 내 각 요소가 숫자인지 확인
  menu_ids?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description: '각 메뉴의 중량. 안 먹었어요 등록 시 생략',
    example: [330, 250],
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber(oneDecimalNumberOptions, { each: true })
  menu_quantities?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description:
      '각 메뉴의 입력 방식  \n0: 단위 탭  \n1: 중량 탭  \n안 먹었어요 등록 시 생략',
    example: [0, 1],
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  @IsIn([0, 1], {
    each: true,
    message: 'each value in menu_input_modes must be 0 or 1',
  })
  menu_input_modes?: number[];

  @ApiPropertyOptional({
    type: [Number],
    nullable: true,
    description: '함께 기록할 세트 id 목록. 없으면 null 또는 생략',
    example: [1, 2],
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  menu_set_ids?: number[] | null;
}
