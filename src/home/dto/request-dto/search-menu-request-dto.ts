import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchMenuRequestDto {
  @ApiProperty({
    type: String,
    description: '입력값',
    example: '싸이버거',
  })
  @IsNotEmpty()
  @IsString()
  input: string;
}
