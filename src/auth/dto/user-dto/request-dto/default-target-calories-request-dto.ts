import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class DefaltTargetCaloriesRequestDto {
  @ApiProperty({
    type: Number,
    description: '성별',
    example: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  gender: number;

  @ApiProperty({
    type: Number,
    description: '출생년도',
    example: 1999,
  })
  @IsNotEmpty()
  @IsNumber()
  birthYear: number;

  @ApiProperty({
    type: Number,
    description: '신장',
    example: 170,
  })
  @IsNotEmpty()
  @IsNumber()
  height: number;

  @ApiProperty({
    type: Number,
    description: '체중',
    example: 65,
  })
  @IsNotEmpty()
  @IsNumber()
  weight: number;

  @ApiProperty({
    type: Number,
    description: '활동량',
    example: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  activity: number;

  @ApiProperty({
    type: Number,
    description: '목표',
    example: 2,
  })
  @IsNotEmpty()
  @IsNumber()
  goal: number;
}
