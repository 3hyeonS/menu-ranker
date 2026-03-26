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

export class RegisterWeightRequestDto {
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
    description: '체중 값',
    example: 57.6,
  })
  @IsNotEmpty()
  @IsNumber()
  weight: number;
}
