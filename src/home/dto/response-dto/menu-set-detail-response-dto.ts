import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MenuSimpleResponseDto } from './menu-simple-response-dto';

export class MenuSetDetailResponseDto {
  @ApiProperty({
    type: Number,
    description: '세트 id',
    example: 1,
  })
  set_id: number;

  @ApiProperty({
    type: String,
    description: '세트명',
    example: '단백질 쉐이크',
  })
  set_name: string;

  @ValidateNested({ each: true })
  @ApiProperty({
    type: [MenuSimpleResponseDto],
    description: '메뉴 리스트',
  })
  @Type(() => MenuSimpleResponseDto)
  menu_list: MenuSimpleResponseDto[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 중량',
    example: [30, 100],
  })
  menu_quantities: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 입력 방식  \n0: 단위 탭  \n1: 중량 탭',
    example: [1, 1],
  })
  menu_input_modes: number[];

  constructor(
    setId: number,
    setName: string,
    menuList: MenuSimpleResponseDto[],
    menuQuantities: number[],
    menuInputModes: number[],
  ) {
    this.set_id = setId;
    this.set_name = setName;
    this.menu_list = menuList;
    this.menu_quantities = menuQuantities;
    this.menu_input_modes = menuInputModes;
  }
}
