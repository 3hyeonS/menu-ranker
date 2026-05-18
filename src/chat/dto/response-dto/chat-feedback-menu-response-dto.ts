import { ApiProperty } from '@nestjs/swagger';

export class ChatFeedbackMenuResponseDto {
  @ApiProperty({
    type: String,
    description: '사용자 입력에서 추출한 메뉴명',
    example: '싸이버거',
  })
  input_menu_name: string;

  @ApiProperty({
    type: Number,
    description: '매핑된 메뉴 id',
    example: 512,
  })
  menu_id: number;

  @ApiProperty({
    type: String,
    description: '매핑된 메뉴명',
    example: '싸이버거',
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
    example: 594,
  })
  calories: number;

  @ApiProperty({
    type: Number,
    description: '현재 유저 상황 기준 개별 메뉴 적절성 점수',
    example: 72.5,
  })
  score: number;

  @ApiProperty({
    type: Boolean,
    description: '현재 유저 상황 기준 개별 메뉴 적절 여부',
    example: true,
  })
  is_appropriate: boolean;

  @ApiProperty({
    type: Number,
    description: '메뉴 데이터 출처  \n0: 기본 데이터  \n1: 사용자 등록',
    example: 0,
  })
  data_source: number;
}
