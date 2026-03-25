import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MealResponseDto } from './meal-response-dto';

export class MealRecordResponseDto {
  @ValidateNested()
  @ApiProperty({
    type: [MealResponseDto],
    description: '식사 기록 리스트',
  })
  @Type(() => MealResponseDto)
  meal_list: MealResponseDto[];

  constructor(mealList: MealResponseDto[]) {
    this.meal_list = mealList;
  }
}
