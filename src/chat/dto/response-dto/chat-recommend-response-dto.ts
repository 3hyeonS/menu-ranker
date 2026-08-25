import { ApiProperty } from '@nestjs/swagger';
import { ChatRecommendItemResponseDto } from './chat-recommend-item-response-dto';
import { ChatFeedbackResponseDto } from './chat-feedback-response-dto';

export class ChatRecommendResponseDto {
  @ApiProperty({
    type: String,
    description: '순수 채팅 모드에서는 항상 general',
    example: 'general',
  })
  chat_category: 'feedback' | 'recommendation' | 'general';

  @ApiProperty({
    type: String,
    description: '순수 채팅 모드에서 Gemini가 생성한 원문 텍스트 답변',
    example: '먹어도 괜찮아. 양만 조금 조절하면 돼.',
  })
  intro_message: string;

  @ApiProperty({
    type: String,
    description:
      '이미지 기반 채팅인 경우 이후 대화 맥락에 활용할 이미지 내용 요약',
    required: false,
    example:
      '사진에는 밥, 국, 김치, 고기 반찬이 함께 보이는 한식 식사 구성이 담겨 있어.',
  })
  image_summary?: string;

  @ApiProperty({
    type: [ChatRecommendItemResponseDto],
    description: '상위 10개 추천 메뉴',
    required: false,
  })
  recommendations?: ChatRecommendItemResponseDto[];

  @ApiProperty({
    type: ChatFeedbackResponseDto,
    description: '피드백으로 분류된 경우 메뉴 조합 판단 결과',
    required: false,
  })
  feedback?: ChatFeedbackResponseDto;

  @ApiProperty({
    type: String,
    description: '레거시 범용 질문 모드의 상세 답변',
    required: false,
    example:
      '탄수화물은 운동량과 하루 식사 흐름에 맞춰 나눠 먹는 쪽이 현실적입니다. 감량 중이라도 완전히 끊기보다는 활동량이 많은 시간대나 운동 전후에 배치하면 식욕 조절과 컨디션 유지에 도움이 될 수 있어요.',
  })
  general_answer?: string;
}
