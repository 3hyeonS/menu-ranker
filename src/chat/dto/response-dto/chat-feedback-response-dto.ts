import { ApiProperty } from '@nestjs/swagger';
import { ChatFeedbackMenuResponseDto } from './chat-feedback-menu-response-dto';

export class ChatFeedbackResponseDto {
  @ApiProperty({
    type: [ChatFeedbackMenuResponseDto],
    description: '입력 메뉴와 DB 매핑 결과',
  })
  menus: ChatFeedbackMenuResponseDto[];

  @ApiProperty({
    type: Number,
    description: '조합 총 칼로리',
    example: 880,
  })
  total_calories: number;

  @ApiProperty({
    type: Number,
    description: '현재 유저 상황 기준 조합 적절성 점수',
    example: 72.5,
  })
  score: number;

  @ApiProperty({
    type: Boolean,
    description: '현재 유저 상황 기준 조합 적절 여부',
    example: true,
  })
  is_appropriate: boolean;

  @ApiProperty({
    type: String,
    description: '조합 한 줄 피드백',
    example: '현재 목표와 남은 칼로리 기준에서 무난한 조합입니다.',
  })
  feedback_summary: string;

  @ApiProperty({
    type: String,
    description: '조합 상세 피드백',
    example:
      '두 메뉴를 합산하면 현재 끼니 목표 칼로리와 크게 벗어나지 않아 무난합니다.',
  })
  feedback_reason: string;
}
