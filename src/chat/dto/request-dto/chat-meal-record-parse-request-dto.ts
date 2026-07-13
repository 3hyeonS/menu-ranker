import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ChatMealRecordParseRequestDto {
  @ApiProperty({
    type: String,
    description: '식사 기록으로 정제할 사용자 입력 텍스트',
    example: '참외 1조각이랑 방울토마토 먹었어.',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}
