import { ApiProperty } from '@nestjs/swagger';

export class ChatMealRecordResponseDto {
  @ApiProperty({
    type: Number,
    description: '끼니  \n0: 아침  \n1: 점심  \n2: 저녁  \n3: 간식',
    example: 1,
  })
  time: number;

  @ApiProperty({
    type: [Number],
    description: '기록한 메뉴 id 배열',
    example: [1, 2],
  })
  menu_ids: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 수량/중량 배열',
    example: [1, 250],
  })
  menu_quantities: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 입력 방식  \n0: 단위 탭  \n1: 중량 탭',
    example: [0, 1],
  })
  menu_input_modes: number[];
}
