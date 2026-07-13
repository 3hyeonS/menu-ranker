import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMealRecordParseResponseDto {
  @ApiProperty({
    type: Number,
    description:
      '생성된 채팅 기록 id. 사용자가 후보를 확정하면 /chat/meal-record의 chat_id로 사용할 수 있습니다.',
    example: 123,
  })
  chat_id: number;

  @ApiProperty({
    type: [Number],
    description: 'DB에서 매칭된 메뉴 id 배열',
    example: [270878, 8473],
  })
  menu_ids: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 중량(g) 배열',
    example: [30, 100],
  })
  menu_quantities: number[];

  @ApiPropertyOptional({
    type: Number,
    description:
      '입력에 끼니 정보가 포함된 경우 반환  \n0: 아침  \n1: 점심  \n2: 저녁  \n3: 간식  \n4: 야식',
    example: 3,
  })
  time?: number;

  @ApiPropertyOptional({
    type: String,
    description: '입력에 날짜 정보가 포함된 경우 반환하는 날짜(YYYY-MM-DD)',
    example: '2026-07-13',
  })
  date?: string;
}
