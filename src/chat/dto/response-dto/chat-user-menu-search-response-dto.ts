import { ApiProperty } from '@nestjs/swagger';

export class ChatUserMenuSearchResponseDto {
  @ApiProperty({
    type: [String],
    description:
      '기록 빈도 상위 메뉴, 직접 등록한 개인용 메뉴, 사용자가 등록한 세트 중 검색된 이름 배열. 최대 3개',
    example: ['참외', '단백질 쉐이크 세트'],
  })
  name: string[];
}
