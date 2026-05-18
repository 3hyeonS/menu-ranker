import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

export class ChatMealRecordRequestDto {
  @ApiProperty({
    type: Number,
    description: '식사 기록과 연결할 채팅 기록 id',
    example: 12,
  })
  @IsNotEmpty()
  @IsNumber()
  chat_id: number;

  @ApiProperty({
    type: Number,
    description: '끼니  \n0: 아침  \n1: 점심  \n2: 저녁  \n3: 간식  \n4: 야식',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @IsIn([0, 1, 2, 3, 4], { message: 'time must be 0, 1, 2, 3 or 4' })
  time: number;

  @ApiProperty({
    type: [Number],
    description: '기록한 메뉴 id 배열',
    example: [1, 2],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  menu_ids: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 수량/중량 배열',
    example: [1, 250],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber(oneDecimalNumberOptions, { each: true })
  menu_quantities: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 입력 방식  \n0: 단위 탭  \n1: 중량 탭',
    example: [0, 1],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  @IsIn([0, 1], {
    each: true,
    message: 'each value in menu_input_modes must be 0 or 1',
  })
  menu_input_modes: number[];
}
