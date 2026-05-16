import { ApiProperty } from '@nestjs/swagger';
import { ChatFoodImagePositionResponseDto } from './chat-food-image-position-response-dto';

export class ChatFoodImageRecognizedMenuResponseDto {
  @ApiProperty({
    type: Number,
    description: '인식된 메뉴 id',
    example: 512,
  })
  menu_id: number;

  @ApiProperty({
    type: String,
    description: '인식된 메뉴명',
    example: '싸이버거',
  })
  menu_name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '브랜드명',
    example: '맘스터치',
  })
  brand: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '카테고리',
    example: '버거',
  })
  category: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Gemini가 반환한 인식 신뢰도. 0~1 정규화 값',
    example: 0.86,
  })
  confidence: number | null;

  @ApiProperty({
    type: ChatFoodImagePositionResponseDto,
    description: '사진 내 음식 중심 좌표',
  })
  position: ChatFoodImagePositionResponseDto;
}
