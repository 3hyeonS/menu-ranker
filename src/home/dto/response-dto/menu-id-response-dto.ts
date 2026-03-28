import { ApiProperty } from '@nestjs/swagger';
import { MenuEntity } from '../../entity/menu.entity';

export class MenuIdResponseDto {
  @ApiProperty({
    type: Number,
    description: 'id',
    example: 1,
  })
  id: number;

  constructor(menu: MenuEntity) {
    this.id = menu.id;
  }
}
