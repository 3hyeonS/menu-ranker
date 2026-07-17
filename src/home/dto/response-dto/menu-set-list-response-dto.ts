import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class MenuSetListItemResponseDto {
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

  @ApiProperty({
    type: [String],
    description: '세트에 포함된 메뉴명 목록',
    example: ['아몬드 가루', '콩'],
  })
  menu_names: string[];

  @ApiProperty({
    type: Number,
    description: '세트 전체 칼로리',
    example: 320.5,
  })
  total_calories: number;
}

export class MenuSetListResponseDto {
  @ValidateNested({ each: true })
  @ApiProperty({
    type: [MenuSetListItemResponseDto],
    description: '세트 리스트',
  })
  @Type(() => MenuSetListItemResponseDto)
  set_list: MenuSetListItemResponseDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '다음 페이지 조회 cursor. 더 없으면 null',
    example: 10,
  })
  next_cursor: number | null;

  constructor(
    setList: MenuSetListItemResponseDto[],
    nextCursor: number | null,
  ) {
    this.set_list = setList;
    this.next_cursor = nextCursor;
  }
}
