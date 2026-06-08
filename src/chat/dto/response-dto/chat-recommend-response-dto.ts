import { ApiProperty } from '@nestjs/swagger';
import { ChatRecommendItemResponseDto } from './chat-recommend-item-response-dto';
import { ChatFeedbackResponseDto } from './chat-feedback-response-dto';

export class ChatRecommendResponseDto {
  @ApiProperty({
    type: String,
    description:
      '채팅 분류  \nfeedback: 피드백  \nrecommendation: 추천  \ngeneral: 범용 일반 질문',
    example: 'recommendation',
  })
  chat_category: 'feedback' | 'recommendation' | 'general';

  @ApiProperty({
    type: String,
    description: '채팅 응답 전체를 소개하는 도입 문구',
    example:
      '단백질을 채우기 위한 다이어트식으로 맘스터치에서 추천하는 메뉴를 정리해드렸어요!',
  })
  intro_message: string;

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
    description: '범용 일반 질문으로 분류된 경우 Gemini가 생성한 답변',
    required: false,
    example:
      '탄수화물은 운동량과 하루 식사 흐름에 맞춰 나눠 먹는 쪽이 현실적입니다. 감량 중이라도 완전히 끊기보다는 활동량이 많은 시간대나 운동 전후에 배치하면 식욕 조절과 컨디션 유지에 도움이 될 수 있어요.',
  })
  general_answer?: string;
}
