import { Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';

export type TPlatform = 'KAKAO' | 'APPLE' | 'LOCAL';

@Entity({ name: 'signWith' })
export class SignWithEntity {
  @PrimaryColumn({ type: 'varchar', name: 'platform' })
  platform: TPlatform;

  @OneToMany(() => UserEntity, (user) => user.signWith, {
    nullable: true,
    cascade: true,
  })
  users: UserEntity[];
}
