import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { UserEntity } from './user/user.entity';

@Entity('refreshToken')
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'token', unique: true, nullable: false })
  token: string;

  @CreateDateColumn({
    type: 'datetime',
    name: 'createdAt',
    nullable: false,
  })
  createdAt: Date;

  @Column({ type: 'datetime', name: 'expiresAt', nullable: false })
  expiresAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.refreshTokens, {
    eager: true,
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;
}
