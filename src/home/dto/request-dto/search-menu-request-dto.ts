import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SearchMenuRequestDto {
  @ApiProperty({
    type: String,
    description: '입력값',
    example: '싸이버거',
  })
  @IsNotEmpty()
  @IsString()
  input: string;

  @ApiProperty({
    type: Number,
    description: '한 번에 조회할 메뉴 개수',
    example: 20,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;

  @ApiProperty({
    type: Number,
    description:
      '이전 응답의 next_cursor 값. 첫 조회 시에는 전달하지 않습니다.',
    example: 512,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  cursor?: number;
}
