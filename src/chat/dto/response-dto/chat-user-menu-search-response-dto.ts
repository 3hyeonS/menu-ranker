import { ApiProperty } from '@nestjs/swagger';

export class ChatUserMenuSearchResponseDto {
  @ApiProperty({
    type: [String],
    description:
      '자주 먹었던 메뉴 또는 직접 등록한 개인용 메뉴 중 검색된 메뉴명 배열. 최대 3개',
    example: ['참외', '방울토마토'],
  })
  name: string[];
}
