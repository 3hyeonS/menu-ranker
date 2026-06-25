import { ApiProperty } from '@nestjs/swagger';
import { NutritionLabelRecognitionResponseDto } from '../../../home/dto/response-dto/nutrition-label-recognition-response-dto';

export class ChatNutritionLabelFeedbackResponseDto {
  @ApiProperty({
    type: String,
    description: '채팅 분류  \nfeedback: 피드백',
    example: 'feedback',
  })
  chat_category: 'feedback';

  @ApiProperty({
    type: String,
    description: '영양성분표 인식 결과를 바탕으로 생성한 피드백 문구',
    example:
      '단백질은 챙기기 좋지만 나트륨과 지방 부담은 있는 편이야. 오늘 식사 흐름에 맞춰 양을 조절해서 먹어.',
  })
  intro_message: string;

  @ApiProperty({
    type: String,
    description: '이후 대화 맥락에 활용할 영양성분표 내용 요약',
    required: false,
    example:
      '영양성분표에는 1회 제공량, 열량, 탄수화물, 단백질, 지방, 나트륨 정보가 표시되어 있어.',
  })
  image_summary?: string;

  @ApiProperty({
    type: String,
    description: 'S3에 저장된 영양성분표 이미지 url',
    example:
      'https://bucket.s3.ap-northeast-2.amazonaws.com/chat-images/nutrition-label-feedback/1/20260622/abc123.jpg',
  })
  image_url: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      '영양성분표에서 메뉴명과 브랜드가 모두 인식되어 개인 메뉴로 등록된 경우 해당 메뉴 id. 메뉴명 또는 브랜드 인식 실패 시 null',
    example: 1234,
  })
  menu_id: number | null;

  @ApiProperty({
    type: NutritionLabelRecognitionResponseDto,
    description: '영양성분표에서 인식한 영양성분 값',
  })
  recognized_nutrition: NutritionLabelRecognitionResponseDto;
}
