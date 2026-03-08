import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminSignUpRequestDto {
  @ApiProperty({
    type: String,
    description: '관리자 id',
    example: 'admin1',
  })
  @IsNotEmpty() // null 값 체크
  @IsString()
  @Length(1, 20) // 문자 수
  adminId: string;

  @ApiProperty({
    type: String,
    description: '이메일(이메일 형식만 허용)',
    example: 'sample@email.com',
  })
  @IsNotEmpty()
  @IsEmail() // 이메일 형식
  @Length(1, 100)
  email: string;
}
