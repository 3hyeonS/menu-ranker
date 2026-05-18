import { ApiProperty } from '@nestjs/swagger';
import { ChatFeedbackResponseDto } from './chat-feedback-response-dto';
import { ChatFoodImageRecognizedMenuResponseDto } from './chat-food-image-recognized-menu-response-dto';

export class ChatFoodImageFeedbackResponseDto {
  @ApiProperty({
    type: String,
    description: '채팅 분류  \nfeedback: 피드백',
    example: 'feedback',
  })
  chat_category: 'feedback';

  @ApiProperty({
    type: String,
    description: '피드백 결과 전체를 소개하는 도입 문구',
    example: '음식 사진에서 인식한 메뉴를 기준으로 현재 목표에 맞는지 확인했어요.',
  })
  intro_message: string;

  @ApiProperty({
    type: String,
    description: 'S3에 저장된 음식 이미지 url',
    example:
      'https://bucket.s3.ap-northeast-2.amazonaws.com/chat-images/food-image-feedback/1/20260518/abc123.jpg',
  })
  image_url: string;

  @ApiProperty({
    type: ChatFeedbackResponseDto,
    description: '사진에서 인식한 메뉴 조합 판단 결과',
  })
  feedback: ChatFeedbackResponseDto;

  @ApiProperty({
    type: [ChatFoodImageRecognizedMenuResponseDto],
    description:
      '사진에서 인식한 메뉴와 좌표. 같은 메뉴가 여러 개 보이면 각각 별도 항목으로 반환',
  })
  recognized_foods: ChatFoodImageRecognizedMenuResponseDto[];
}
