import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

const CURRENT_YEAR = new Date().getFullYear();

export class UpdateBirthYearRequestDto {
  @ApiProperty({
    type: Number,
    description: '출생년도',
    example: 1999,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(CURRENT_YEAR - 100)
  @Max(CURRENT_YEAR - 10)
  birthYear: number;
}
