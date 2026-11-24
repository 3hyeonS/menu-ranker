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
    nullable: true,
    description:
      '브랜드 식당 ID(/restaurant/detail 요청에 사용). 개인 식당이면 null이고, 이때는 /restaurant/place로 카카오 메뉴를 조회합니다.',
    example: 1204,
  })
  restaurant_id: number | null;

  @ApiProperty({
    type: String,
    description: '브랜드명. 개인 식당이면 카카오 장소명(place_name)',
    example: '롯데리아',
  })
  restaurant_name: string;
}

export class RestaurantBrandsResponseDto {
  @ApiProperty({
    type: [RestaurantBrandPlaceResponseDto],
    description:
      '수집한 장소(프랜차이즈 지점과 개인 식당)를 요청 순서대로 반환합니다. 수집하지 않은 장소는 빠집니다.',
  })
  restaurants: RestaurantBrandPlaceResponseDto[];
}
