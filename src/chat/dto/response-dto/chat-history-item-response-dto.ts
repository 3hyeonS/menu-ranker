import { ApiProperty } from '@nestjs/swagger';
import { ChatHistoryEntity } from '../../entity/chat-history.entity';
import { ChatRecommendResponseDto } from './chat-recommend-response-dto';

export class ChatHistoryItemResponseDto {
  @ApiProperty({
    type: Number,
    description: '채팅 기록 id',
    example: 12,
  })
  id: number;

  @ApiProperty({
    type: String,
    description: '사용자 입력값',
    example: '단백질 채울 수 있는 맘스터치 메뉴 추천해줘',
  })
  input_text: string;

  @ApiProperty({
    type: String,
    description: '저장 시각',
    example: '2026-04-03T14:20:31.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    type: ChatRecommendResponseDto,
    description: '당시 저장된 추천 응답 전체 JSON',
  })
  response_payload: ChatRecommendResponseDto;

  constructor(chatHistory: ChatHistoryEntity) {
    this.id = chatHistory.id;
    this.input_text = chatHistory.input_text;
    this.createdAt = chatHistory.createdAt;
    this.response_payload =
      chatHistory.response_payload as unknown as ChatRecommendResponseDto;
  }
}
