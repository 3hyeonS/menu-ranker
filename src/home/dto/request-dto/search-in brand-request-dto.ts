import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SearchInBrandRequestDto {
  @ApiProperty({
    type: String,
    description: '브랜드',
    example: '맘스터치',
  })
  @IsOptional()
  @IsString()
  brand: string = null;

  @ApiProperty({
    type: String,
    description: '입력값',
    example: '싸이버거',
  })
  @IsNotEmpty()
  @IsString()
  input: string;
}
