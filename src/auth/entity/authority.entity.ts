import { Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user/user.entity';

export const USER_ROLES = ['USER', 'TESTER', 'ADMIN'] as const;
export type TRole = (typeof USER_ROLES)[number];

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
