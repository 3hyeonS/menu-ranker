import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ChatUserMenuSearchRequestDto {
  @ApiProperty({
    type: String,
    description: '검색할 메뉴명',
    example: '참외',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}
