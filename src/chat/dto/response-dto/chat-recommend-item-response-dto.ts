import { ApiProperty } from '@nestjs/swagger';

export class ChatRecommendItemResponseDto {
  @ApiProperty({
    type: Number,
    description: '메뉴 id',
    example: 512,
  })
  menu_id: number;

  @ApiProperty({
    type: String,
    description: '메뉴명',
    example: '그릴드 치킨 버거',
  })
  menu_name: string;

  @ApiProperty({
    type: Number,
    description: '중량 단위  \n0: g  \n1: ml',
    example: 0,
  })
  unit: number;

  @ApiProperty({
    type: Number,
    description: '중량',
    example: 230,
  })
  weight: number;

  @ApiProperty({
    type: String,
    description: '중량 단위량',
    example: '인분',
  })
  unit_quantity: string;

  @ApiProperty({
    type: Number,
    description: '칼로리',
    example: 412.5,
  })
  calories: number;

  @ApiProperty({
    type: Number,
    description: '메뉴 데이터 출처  \n0: 기본 데이터  \n1: 사용자 등록',
    example: 0,
  })
  data_source: number;

  @ApiProperty({
    type: Number,
    description: '최종 점수',
    example: 84.6,
  })
  score: number;

  @ApiProperty({
    type: Number,
    description: '순위',
    example: 1,
  })
  rank: number;

  @ApiProperty({
    type: String,
    description: '한 줄 요약 설명',
    example: '단백질 밀도가 높고 점심 칼로리 예산에 잘 맞는 선택입니다.',
  })
  one_line_summary: string;

  @ApiProperty({
    type: String,
    description: '상세 추천 이유',
    example:
      '목표 단백질 비중을 맞추는 데 유리하고, 당 밀도와 칼로리 밀도가 과도하지 않아 점심 한 끼로 안정적입니다.',
  })
  recommendation_reason: string;
}
