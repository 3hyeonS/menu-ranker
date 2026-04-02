import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ChatHistoryItemResponseDto } from './chat-history-item-response-dto';

export class ChatHistoryResponseDto {
  @ValidateNested()
  @ApiProperty({
    type: [ChatHistoryItemResponseDto],
    description: '최신순 채팅 기록 리스트',
  })
  @Type(() => ChatHistoryItemResponseDto)
  chat_list: ChatHistoryItemResponseDto[];

  constructor(chatList: ChatHistoryItemResponseDto[]) {
    this.chat_list = chatList;
  }
}
