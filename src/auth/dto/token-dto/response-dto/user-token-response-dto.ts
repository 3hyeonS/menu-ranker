import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { UserResponseDto } from '../../user-dto/response-dto/user-response-dto';

export class UserTokenResponseDto {
  @ApiProperty({ example: 'accessTokenExample' })
  acccessToken: string;

  @ApiProperty({ example: 'refreshTokenExample' })
  refreshToken: string;

  @ApiProperty({
    oneOf: [{ $ref: getSchemaPath(UserResponseDto) }],
  })
  user: UserResponseDto;
}
