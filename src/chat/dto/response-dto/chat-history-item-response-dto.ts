import { ApiProperty } from '@nestjs/swagger';
import { ChatHistoryEntity } from '../../entity/chat-history.entity';
import { ChatRecommendResponseDto } from './chat-recommend-response-dto';
import { ChatMealRecordResponseDto } from './chat-meal-record-response-dto';
import { stripPublicMenuSourcePrefix } from '../../../utils/menu-name.util';

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

  @ApiProperty({
    type: String,
    nullable: true,
    description: '이미지 기반 채팅인 경우 S3에 저장된 입력 이미지 url',
    example:
      'https://bucket.s3.ap-northeast-2.amazonaws.com/chat-images/food-image-feedback/1/20260518/abc123.jpg',
  })
  image_url: string | null;

  @ApiProperty({
    type: ChatMealRecordResponseDto,
    nullable: true,
    description: '해당 채팅에서 식사 기록을 진행한 경우 저장되는 식사 기록 메타데이터',
  })
  meal_record: ChatMealRecordResponseDto | null;

  constructor(chatHistory: ChatHistoryEntity) {
    this.id = chatHistory.id;
    this.input_text = chatHistory.input_text;
    this.createdAt = chatHistory.createdAt;
    this.response_payload = this.stripMenuSourcePrefixesFromPayload(
      chatHistory.response_payload,
    ) as unknown as ChatRecommendResponseDto;
    this.image_url =
      typeof chatHistory.response_payload?.image_url === 'string'
        ? chatHistory.response_payload.image_url
        : null;
    this.meal_record = this.stripMenuSourcePrefixesFromPayload(
      chatHistory.meal_record,
    ) as ChatMealRecordResponseDto | null;
  }

  private stripMenuSourcePrefixesFromPayload(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.stripMenuSourcePrefixesFromPayload(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        typeof entry === 'string' && this.isMenuNameField(key)
          ? stripPublicMenuSourcePrefix(entry)
          : this.stripMenuSourcePrefixesFromPayload(entry),
      ]),
    );
  }

  private isMenuNameField(key: string): boolean {
    return ['name', 'menu', 'menu_name'].includes(key);
  }
}
