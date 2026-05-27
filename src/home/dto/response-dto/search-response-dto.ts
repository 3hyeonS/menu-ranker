import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MenuSimpleResponseDto } from './menu-simple-response-dto';

export class SearchResponseDto {
  @ApiProperty({
    type: Boolean,
    description: '검색 결과 존재 여부',
    example: true,
  })
  has_result: boolean;

  @ValidateNested()
  @ApiProperty({
    type: [MenuSimpleResponseDto],
    description: '메뉴 리스트',
  })
  @Type(() => MenuSimpleResponseDto)
  menu_list: MenuSimpleResponseDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      '다음 페이지 조회에 사용할 cursor(menu_id). 더 조회할 데이터가 없으면 null',
    example: 512,
  })
  next_cursor: number | null;

  constructor(
    hasResult: boolean,
    menuList: MenuSimpleResponseDto[],
    nextCursor: number | null,
  ) {
    this.has_result = hasResult;
    this.menu_list = menuList;
    this.next_cursor = nextCursor;
  }
}
