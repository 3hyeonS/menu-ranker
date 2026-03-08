import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminSignInRequestDto {
  @ApiProperty({
    type: String,
    description: '관리자 id',
    example: 'admin1',
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 20)
  adminId: string;

  @ApiProperty({
    type: String,
    description: '이메일',
    example: 'sample@email.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
