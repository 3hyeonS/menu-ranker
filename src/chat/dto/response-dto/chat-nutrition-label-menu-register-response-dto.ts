import { ApiProperty } from '@nestjs/swagger';
import { MenuEntity } from '../../../home/entity/menu.entity';

export class ChatNutritionLabelMenuRegisterResponseDto {
  @ApiProperty({
    type: Number,
    description: '등록된 개인 메뉴 id',
    example: 270901,
  })
  menu_id: number;

  constructor(menu: MenuEntity) {
    this.menu_id = menu.id;
  }
}
