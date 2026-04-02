import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateGenderRequestDto {
  @ApiProperty({
    enum: [0, 1],
    description: '성별 (0: 남성, 1: 여성)',
    example: 0,
  })
  @IsNotEmpty()
  @IsIn([0, 1])
  gender: number;
}
