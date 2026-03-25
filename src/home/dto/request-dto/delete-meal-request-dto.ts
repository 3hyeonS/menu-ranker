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

export class DeleteMealRequestDto {
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
    type: Number,
    description: '메뉴 id',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  menu_id: number;
}
