import { ApiProperty } from '@nestjs/swagger';

export class RestaurantSummaryResponseDto {
  @ApiProperty({ type: Number, description: '식당 ID', example: 1204 })
  restaurant_id: number;

  @ApiProperty({
    type: String,
    description: '식당명(브랜드명)',
    example: '피자스쿨',
  })
  restaurant_name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '해당 식당 메뉴의 대표 카테고리',
    example: '피자',
  })
  category: string | null;
}

export class RestaurantSearchResponseDto {
  @ApiProperty({ type: [RestaurantSummaryResponseDto] })
  restaurant_list: RestaurantSummaryResponseDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '다음 조회에 전달할 cursor. 다음 페이지가 없으면 null',
    example: 1420,
  })
  next_cursor: number | null;
}
