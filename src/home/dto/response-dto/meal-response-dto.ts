import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MenuSimpleResponseDto } from './menu-simple-response-dto';

export class MealResponseDto {
  @ApiProperty({
    type: Number,
    description: '끼니  \n0:아침  \n1: 점심  \n2:저녁  \n3: 간식  \n4:야식',
    example: 1,
  })
  time: number;

  @ApiProperty({
    type: String,
    description: '실제 식사 시각',
    example: '12:30',
    nullable: true,
  })
  meal_time: string | null;

  @ApiProperty({
    type: String,
    description: '이미지 파일 url',
    example: 'imageUrl',
  })
  image: string = null;

  @ApiProperty({
    type: Date,
    description: '식사 기록 생성 시각',
    example: '2026-05-27T12:34:56.789Z',
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
    description: '식사 기록 수정 시각',
    example: '2026-05-27T13:10:20.123Z',
  })
  updatedAt: Date;

  @ValidateNested()
  @ApiProperty({
    type: [MenuSimpleResponseDto],
    description: '메뉴 리스트',
  })
  @Type(() => MenuSimpleResponseDto)
  menu_list: MenuSimpleResponseDto[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 수량',
    example: [1, 2.5],
  })
  menu_quantities: number[];

  @ApiProperty({
    type: [Number],
    description: '각 메뉴의 입력 방식  \n0: 단위 탭  \n1: 중량 탭',
    example: [0, 1],
  })
  menu_input_modes: number[];

  constructor(
    time: number,
    mealTime: string | null,
    image: string,
    createdAt: Date,
    updatedAt: Date,
    menuList: MenuSimpleResponseDto[],
    menuQunatities: number[],
    menuInputModes: number[],
  ) {
    this.time = time;
    this.meal_time = mealTime;
    this.image = image;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.menu_list = menuList;
    this.menu_quantities = menuQunatities;
    this.menu_input_modes = menuInputModes;
  }
}
