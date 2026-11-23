import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { KAKAO_PLACE_ID_PATTERN } from './restaurant-brands-request-dto';

export class RestaurantPlaceRequestDto {
  @ApiProperty({
    oneOf: [{ type: 'number' }, { type: 'string' }],
    description: '카카오 로컬 API 응답의 장소 id. number 또는 숫자 문자열',
    example: 21605481,
  })
  // 카카오 id는 문자열이라 number로 와도 문자열로 바꿔 /restaurant/brands와 같은 규칙으로 검증한다.
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : value))
  @IsString()
  @Matches(KAKAO_PLACE_ID_PATTERN)
  place_id: string;
}
