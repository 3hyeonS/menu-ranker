import { ApiProperty } from '@nestjs/swagger';

export class RestaurantBrandPlaceResponseDto {
  @ApiProperty({
    type: Number,
    description: '요청한 카카오 장소 id',
    example: 27531028,
  })
  place_id: number;

  @ApiProperty({
    type: Number,
    description: '식당 ID(/restaurant/detail 요청에 사용)',
    example: 1204,
  })
  restaurant_id: number;

  @ApiProperty({
    type: String,
    description: '식당명(브랜드명)',
    example: '롯데리아',
  })
  restaurant_name: string;
}

export class RestaurantBrandsResponseDto {
  @ApiProperty({
    type: [RestaurantBrandPlaceResponseDto],
    description:
      '등록된 브랜드에 매핑된 장소만 요청 순서대로 반환합니다. 매핑이 없는 장소는 빠집니다.',
  })
  restaurants: RestaurantBrandPlaceResponseDto[];
}
