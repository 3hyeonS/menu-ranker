import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterSubCodeRequestDto {
  @ApiProperty({
    type: String,
    description: '구독 코드',
    example: 'subCodeExample',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmedValue = value.trim();
    return trimmedValue === '' ? undefined : trimmedValue;
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  subCode: string;
}
