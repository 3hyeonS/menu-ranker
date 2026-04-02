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
}
