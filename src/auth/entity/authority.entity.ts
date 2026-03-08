import { Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user/user.entity';

export type TRole = 'USER' | 'ADMIN';

@Entity({ name: 'authority' })
export class AuthorityEntity {
  @PrimaryColumn({ type: 'varchar', name: 'role' })
  role: TRole;

  @OneToMany(() => UserEntity, (user) => user.authority, {
    nullable: true,
    cascade: true,
  })
  users: UserEntity[];
}
