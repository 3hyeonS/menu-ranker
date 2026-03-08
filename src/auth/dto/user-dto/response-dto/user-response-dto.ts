import { ApiProperty } from '@nestjs/swagger';
import { TRole } from 'src/auth/entity/authority.entity';
import { TPlatform } from 'src/auth/entity/user/signWith.entity';
import { UserEntity } from 'src/auth/entity/user/user.entity';

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '홍길동' })
  nickname: string;

  @ApiProperty({ example: 'example@email.com' })
  email: string;

  @ApiProperty({ example: 'KAKAO' })
  platform: TPlatform;

  @ApiProperty({ example: 'USER' })
  role: TRole;

  constructor(user: UserEntity) {
    this.id = user.id;
    this.nickname = user.nickname;
    this.email = user.email;
    this.platform = user.signWith.platform;
    this.role = user.authority.role;
  }
}
