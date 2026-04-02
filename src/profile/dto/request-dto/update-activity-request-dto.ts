import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateActivityRequestDto {
  @ApiProperty({
    enum: [0, 1, 2, 3],
    description: '활동량(리스트 순서대로 0, 1, 2, 3)',
    example: 0,
  })
  @IsNotEmpty()
  @IsIn([0, 1, 2, 3])
  activity: number;
}
