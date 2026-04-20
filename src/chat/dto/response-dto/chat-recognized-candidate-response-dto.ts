import { ApiProperty } from '@nestjs/swagger';

export class ChatRecognizedCandidateResponseDto {
  @ApiProperty({
    type: Number,
    description: '후보 메뉴 id',
    example: 512,
  })
  menu_id: number;

  @ApiProperty({
    type: String,
    description: '후보 메뉴명',
    example: '그릴드 치킨 버거',
  })
  menu: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '브랜드',
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
}
