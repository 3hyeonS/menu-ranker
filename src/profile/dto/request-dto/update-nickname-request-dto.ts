import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateNicknameRequestDto {
  @ApiProperty({
    type: String,
    description: '닉네임',
    example: '멜로유저',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  nickname: string;
}
