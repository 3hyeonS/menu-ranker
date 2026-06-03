import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateInquiryRequestDto {
  @ApiProperty({
    type: String,
    description: '문의 내용',
    example: '입력한 구독 코드가 반영되지 않는 것 같아요. 확인 부탁드립니다.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  content: string;

  @ApiProperty({
    type: String,
    description: '앱 버전',
    example: '1.2.3',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  app_version: string;

  @ApiProperty({
    type: String,
    description: '운영체제 이름',
    example: 'iOS',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  os_name: string;

  @ApiProperty({
    type: String,
    description: '운영체제 버전',
    example: '17.5.1',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  os_version: string;
}
