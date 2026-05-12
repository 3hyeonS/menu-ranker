import { ApiProperty } from '@nestjs/swagger';
import { ChatRecommendItemResponseDto } from './chat-recommend-item-response-dto';
import { ChatFeedbackResponseDto } from './chat-feedback-response-dto';

export class ChatRecommendResponseDto {
  @ApiProperty({
    type: String,
    description: '채팅 분류  \nfeedback: 피드백  \nrecommendation: 추천',
    example: 'recommendation',
  })
  chat_category: 'feedback' | 'recommendation';

  @ApiProperty({
    type: String,
    description: '추천 결과 전체를 소개하는 도입 문구',
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
}
