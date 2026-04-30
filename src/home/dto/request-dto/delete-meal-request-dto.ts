import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsNotEmpty,
  IsNumber,
  ValidateIf,
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

  @ApiPropertyOptional({
    type: Number,
    description: '메뉴 id. 안 먹었어요 삭제 시 생략',
    example: 1,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber()
  menu_id?: number;
}
