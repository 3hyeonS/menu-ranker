import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MenuSimpleResponseDto } from './menu-simple-response-dto';

export class SearchResponseDto {
  @ApiProperty({
    type: Boolean,
    description:
      '결과값 여부  \ntrue: 결과값 있음  \nfalse: 결과값 없음(유사 메뉴/브랜드 출력)',
    example: false,
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
    type: [String],
    description: '브랜드 리스트',
    example: ['싸이버거', '버거킹'],
  })
  brand_list: string[];

  constructor(
    hasResult: boolean,
    menuList: MenuSimpleResponseDto[],
    brandList: string[],
  ) {
    this.has_result = hasResult;
    this.menu_list = menuList;
    this.brand_list = brandList;
  }
}
