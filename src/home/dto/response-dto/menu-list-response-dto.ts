import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MenuSimpleResponseDto } from './menu-simple-response-dto';

export class MenuListResponseDto {
  @ValidateNested()
  @ApiProperty({
    type: [MenuSimpleResponseDto],
    description: '메뉴 리스트',
  })
  @Type(() => MenuSimpleResponseDto)
  menu_list: MenuSimpleResponseDto[];

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      '다음 페이지 조회 cursor. 직접 등록 메뉴 조회에서 다음 페이지가 없거나 limit를 생략하면 null',
    example: 512,
  })
  next_cursor?: number | null;

  constructor(menuList: MenuSimpleResponseDto[], nextCursor?: number | null) {
    this.menu_list = menuList;
    if (nextCursor !== undefined) {
      this.next_cursor = nextCursor;
    }
  }
}
