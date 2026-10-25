import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChatRecommendRequestDto {
  @ApiProperty({
    type: String,
    description: '채팅 입력값',
    example: '단백질 채울 수 있는 맘스터치 메뉴 추천해줘',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  input: string;
}
