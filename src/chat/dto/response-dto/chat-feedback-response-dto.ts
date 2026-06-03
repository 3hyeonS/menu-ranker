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
    description: '현재 유저 상황 기준 통합 조합 적절성 점수',
    example: 72.5,
  })
  score: number;

  @ApiProperty({
    type: Boolean,
    description: '현재 유저 상황 기준 조합 적절 여부',
    example: true,
  })
  is_appropriate: boolean;
}
