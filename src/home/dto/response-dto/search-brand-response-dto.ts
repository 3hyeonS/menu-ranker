import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MenuSimpleResponseDto } from './menu-simple-response-dto';

export class SearchBrandResponseDto {
  @ApiProperty({
    type: [String],
    description: '브랜드 리스트',
    example: ['싸이버거', '버거킹'],
  })
  brand_list: string[];

  constructor(brandList: string[]) {
    this.brand_list = brandList;
  }
}
