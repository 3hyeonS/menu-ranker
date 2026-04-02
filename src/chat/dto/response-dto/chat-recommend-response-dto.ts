import { ApiProperty } from '@nestjs/swagger';
import { ChatParsedRequestResponseDto } from './chat-parsed-request-response-dto';
import { ChatRecommendationBasisResponseDto } from './chat-recommendation-basis-response-dto';
import { ChatRecommendItemResponseDto } from './chat-recommend-item-response-dto';

export class ChatRecommendResponseDto {
  @ApiProperty({
    type: String,
    description: '추천 결과 전체를 소개하는 도입 문구',
    example:
      '단백질을 채우기 위한 다이어트식으로 맘스터치에서 추천하는 메뉴를 정리해드렸어요!',
  })
  intro_message: string;

  @ApiProperty({
    type: ChatParsedRequestResponseDto,
    description: 'Gemini가 구조화한 요청 스키마',
  })
  parsed_request: ChatParsedRequestResponseDto;

  @ApiProperty({
    type: ChatRecommendationBasisResponseDto,
    description: '추천 순위 산정에 사용한 개인화 컨텍스트',
  })
  recommendation_basis: ChatRecommendationBasisResponseDto;

  @ApiProperty({
    type: [ChatRecommendItemResponseDto],
    description: '상위 10개 추천 메뉴',
  })
  recommendations: ChatRecommendItemResponseDto[];
}
