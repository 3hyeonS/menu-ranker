import { ApiProperty } from '@nestjs/swagger';

export class ChatFoodImagePositionResponseDto {
  @ApiProperty({
    type: Number,
    description: '추출된 음식의 중심 x 좌표. 이미지 너비 기준 0~1 정규화 값',
    example: 0.29,
  })
  x: number;

  @ApiProperty({
    type: Number,
    description: '추출된 음식의 중심 y 좌표. 이미지 높이 기준 0~1 정규화 값',
    example: 0.45,
  })
  y: number;
}
