import { ApiProperty } from '@nestjs/swagger';

export class RecentMenuResponseDto {
  @ApiProperty({ type: Number, description: '메뉴 ID', example: 123 })
  menu_id: number;

  @ApiProperty({ type: String, description: '메뉴명', example: '닭가슴살' })
  menu_name: string;

  constructor(menuId: number, menuName: string) {
    this.menu_id = menuId;
    this.menu_name = menuName;
  }
}
