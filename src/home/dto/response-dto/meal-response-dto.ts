import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MenuSimpleResponseDto } from './menu-simple-response-dto';

export class MealResponseDto {
  @ApiProperty({
    type: Number,
    description: '끼니  \n0:아침  \n1: 점심  \n2:저녁  \n3: 간식  \n4:야식',
    example: 1,
  })
  time: number;

  @ApiProperty({
    type: String,
    description: '이미지 파일 url',
    example: 'imageUrl',
  })
  image: string = null;

  @ValidateNested()
  @ApiProperty({
    type: [MenuSimpleResponseDto],
    description: '메뉴 리스트',
  })
  @Type(() => MenuSimpleResponseDto)
  menu_list: MenuSimpleResponseDto[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 수량',
    example: [1, 2],
  })
  menu_quantities: number[];

  constructor(
    time: number,
    image: string,
    menuList: MenuSimpleResponseDto[],
    menuQunatities: number[],
  ) {
    this.time = time;
    this.image = image;
    this.menu_list = menuList;
    this.menu_quantities = menuQunatities;
  }
}
