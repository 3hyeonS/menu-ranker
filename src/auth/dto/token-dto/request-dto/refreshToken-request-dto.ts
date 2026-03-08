import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiProperty({
    type: String,
    description: '기존 refreshToken',
    example: 'refreshTokenExample',
  })
  @IsNotEmpty()
  @IsJWT()
  refreshToken: string;
}
