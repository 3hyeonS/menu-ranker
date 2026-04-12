import { ApiProperty } from '@nestjs/swagger';

type FoodImageRecognitionInput = {
  menu_ids: number[];
  menu_quantities: number[];
  image_url: string;
};

export class FoodImageRecognitionResponseDto {
  @ApiProperty({
    type: [Number],
    description: '인식된 메뉴 id 배열',
    example: [1, 5],
  })
  menu_ids: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 수량 배열',
    example: [1, 2],
  })
  menu_quantities: number[];

  @ApiProperty({
    type: String,
    description: 'S3에 저장된 이미지 url',
    example: 'https://bucket.s3.ap-northeast-2.amazonaws.com/meal-recognition/1/20260412/abc123',
  })
  image_url: string;

  constructor(value: FoodImageRecognitionInput) {
    Object.assign(this, value);
  }
}
