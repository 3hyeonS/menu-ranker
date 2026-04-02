import { ApiProperty } from '@nestjs/swagger';

export class ChatParsedRequestResponseDto {
  @ApiProperty({
    type: String,
    description: '원본 입력 문장',
    example: '단백질 채울 수 있는 맘스터치 메뉴 추천해줘',
  })
  original_input: string;

  @ApiProperty({
    type: String,
    description: '정규화된 요청 문장',
    example: '맘스터치에서 단백질 보충에 적합한 메뉴 추천',
  })
  normalized_request: string;

  @ApiProperty({
    type: Number,
    description: '섭취 시간대  \n0: 아침  \n1: 점심  \n2: 저녁  \n3: 간식  \n4: 야식',
    example: 1,
  })
  meal_time: number;

  @ApiProperty({
    type: String,
    description: '섭취 시간대 라벨',
    example: '점심',
  })
  meal_time_label: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '브랜드 필터',
    example: '맘스터치',
  })
  desired_brand: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '카테고리 필터',
    example: '샌드위치',
  })
  desired_category: string;

  @ApiProperty({
    type: [String],
    description: '영양 우선순위',
    example: ['high_protein'],
  })
  nutrition_focus: string[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: '섭취량 선호  \nlight / regular / hearty',
    example: 'regular',
  })
  amount_preference: string;

  @ApiProperty({
    type: [String],
    description: '검색 보조 키워드',
    example: ['단백질', '맘스터치'],
  })
  keywords: string[];
}
