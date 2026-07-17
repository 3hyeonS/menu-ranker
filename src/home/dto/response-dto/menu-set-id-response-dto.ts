import { ApiProperty } from '@nestjs/swagger';

export class MenuSetIdResponseDto {
  @ApiProperty({
    type: Number,
    description: '세트 id',
    example: 1,
  })
  set_id: number;

  constructor(setId: number) {
    this.set_id = setId;
  }
}
