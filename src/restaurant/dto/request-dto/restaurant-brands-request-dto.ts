import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';

export const RESTAURANT_BRANDS_MAX_PLACE_IDS = 100;

export class RestaurantBrandsRequestDto {
  @ApiProperty({
    type: 'array',
    items: { oneOf: [{ type: 'number' }, { type: 'string' }] },
    minItems: 1,
    maxItems: RESTAURANT_BRANDS_MAX_PLACE_IDS,
    description:
      '카카오 로컬 API 응답의 장소 id 목록. number 또는 숫자 문자열(1~100개, 중복은 무시)',
    example: [27531028, '1765423970'],
  })
  // 카카오 id는 문자열이라 number로 와도 문자열로 바꿔 같은 규칙으로 검증한다.
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'number' ? String(item) : item))
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(RESTAURANT_BRANDS_MAX_PLACE_IDS)
  @IsString({ each: true })
  // 응답에서 number로 돌려주므로 안전한 정수 범위(15자리)까지만 받는다.
  @Matches(/^[1-9]\d{0,14}$/, { each: true })
  place_ids: string[];
}
