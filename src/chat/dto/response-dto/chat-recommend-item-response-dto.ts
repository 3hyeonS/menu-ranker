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
    type: String,
    nullable: true,
    description: '브랜드명',
    example: '맘스터치',
  })
  brand: string | null;

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

}
