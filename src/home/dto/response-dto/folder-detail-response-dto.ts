import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MenuSimpleResponseDto } from './menu-simple-response-dto';

export class FolderDetailResponseDto {
  @ApiProperty({
    type: String,
    description: '폴더명',
    example: '자주 먹는 아침',
  })
  folder_name: string;

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
    example: [330, 250],
  })
  menu_quantities: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 입력 방식  \n0: 단위 탭  \n1: 중량 탭',
    example: [0, 1],
  })
  menu_input_modes: number[];

  constructor(
    folderName: string,
    menuList: MenuSimpleResponseDto[],
    menuQuantities: number[],
    menuInputModes: number[],
  ) {
    this.folder_name = folderName;
    this.menu_list = menuList;
    this.menu_quantities = menuQuantities;
    this.menu_input_modes = menuInputModes;
  }
}
