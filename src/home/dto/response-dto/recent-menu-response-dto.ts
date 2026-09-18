import { ApiProperty } from '@nestjs/swagger';

export class RecentMenuResponseDto {
  @ApiProperty({ type: Number, description: '메뉴 ID', example: 123 })
  menu_id: number;

  @ApiProperty({ type: String, description: '메뉴명', example: '닭가슴살' })
  menu_name: string;

  @ApiProperty({
    type: String,
    description: '브랜드명',
    example: '비비고',
    nullable: true,
  })
  brand: string | null;

  constructor(menuId: number, menuName: string, brand: string | null) {
    this.menu_id = menuId;
    this.menu_name = menuName;
    this.brand = brand;
  }
}
