import { ApiProperty } from '@nestjs/swagger';

export class RestaurantPlaceMenuResponseDto {
  @ApiProperty({ type: String, description: '메뉴명', example: '착한김밥' })
  menu_name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '메뉴 사진 URL(카카오 CDN, https). 없으면 null',
    example: 'https://t1.kakaocdn.net/mystore/7AA913BF7DA24A688E02148624CD0FBB',
  })
  photo_url: string | null;
}

export class RestaurantPlaceResponseDto {
  @ApiProperty({
    type: Number,
    description: '요청한 카카오 장소 id',
    example: 21605481,
  })
  place_id: number;

  @ApiProperty({
    type: String,
    description: '카카오 장소명(지점명 포함)',
    example: '착한떡볶이',
  })
  place_name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '주소(도로명, 없으면 지번)',
    example: '서울 송파구 충민로 5',
  })
  address: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      '프랜차이즈면 브랜드 식당 ID(/restaurant/detail로 영양정보 메뉴 조회). 개인 식당이면 null',
    example: null,
  })
  restaurant_id: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '프랜차이즈면 브랜드명. 개인 식당이면 null',
    example: null,
  })
  restaurant_name: string | null;

  @ApiProperty({
    type: [RestaurantPlaceMenuResponseDto],
    description:
      '카카오 지점 메뉴(카카오 표시 순서). 영양정보는 없습니다. 메뉴가 없으면 빈 배열',
  })
  menu_list: RestaurantPlaceMenuResponseDto[];
}
