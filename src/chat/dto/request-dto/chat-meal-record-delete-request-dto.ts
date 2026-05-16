import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class ChatMealRecordDeleteRequestDto {
  @ApiProperty({
    type: Number,
    description: '식사 기록 메타데이터를 삭제할 채팅 기록 id',
    example: 12,
  })
  @IsNotEmpty()
  @IsNumber()
  chat_id: number;
}
