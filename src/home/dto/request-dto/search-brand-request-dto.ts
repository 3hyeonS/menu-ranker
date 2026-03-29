import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchBrandRequestDto {
  @ApiProperty({
    type: String,
    description: '입력값',
    example: '맘스터치',
  })
  @IsNotEmpty()
  @IsString()
  input: string;
}
