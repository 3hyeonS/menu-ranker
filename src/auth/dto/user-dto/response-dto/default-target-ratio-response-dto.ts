import { ApiProperty } from '@nestjs/swagger';

export class DefaltRatioResponseDto {
  @ApiProperty({ example: '40' })
  carbs: number;

  @ApiProperty({ example: '35' })
  protein: number;

  @ApiProperty({ example: '25' })
  fat: number;
}
