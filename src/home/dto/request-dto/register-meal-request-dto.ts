import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

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

  @ApiProperty({
    type: String,
    description: '이미지 파일 url',
    example: 'imageUrl',
  })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({
    type: [Number],
    description: '메뉴 id',
    example: [1, 2],
  })
  @IsNotEmpty()
  @IsArray()
  @IsNumber({}, { each: true }) // 배열 내 각 요소가 숫자인지 확인
  menu_ids: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 수량',
    example: [1, 2],
  })
  @IsNotEmpty()
  @IsArray()
  @IsNumber({}, { each: true }) // 배열 내 각 요소가 숫자인지 확인
  menu_quantities: number[];
}
