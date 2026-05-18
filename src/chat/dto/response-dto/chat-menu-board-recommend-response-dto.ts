import { ApiProperty } from '@nestjs/swagger';
import { ChatRecognizedCandidateResponseDto } from './chat-recognized-candidate-response-dto';
import { ChatRecommendItemResponseDto } from './chat-recommend-item-response-dto';

export class ChatMenuBoardRecommendResponseDto {
  @ApiProperty({
    type: String,
    description: '채팅 분류  \nrecommendation: 추천',
    example: 'recommendation',
  })
  chat_category: 'recommendation';

  @ApiProperty({
    type: String,
    description: '추천 결과 전체를 소개하는 도입 문구',
    example:
      '메뉴판에서 인식된 후보 메뉴를 기준으로 점심 추천을 정리해드렸어요!',
  })
  intro_message: string;

  @ApiProperty({
    type: String,
    description: 'S3에 저장된 메뉴판 이미지 url',
    example:
      'https://bucket.s3.ap-northeast-2.amazonaws.com/chat-images/menu-board/1/20260518/abc123.jpg',
  })
  image_url: string;

  @ApiProperty({
    type: [ChatRecommendItemResponseDto],
    description: '상위 10개 추천 메뉴',
  })
  recommendations: ChatRecommendItemResponseDto[];

  @ApiProperty({
    type: [ChatRecognizedCandidateResponseDto],
    description: '메뉴판/이미지 인식으로 좁혀진 후보 메뉴',
  })
  recognized_candidates: ChatRecognizedCandidateResponseDto[];
}
