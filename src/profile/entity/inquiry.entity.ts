import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('inquiry')
export class InquiryEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'text', name: 'content', nullable: false })
  content: string;

  @Column({ type: 'varchar', name: 'app_version', length: 50, nullable: true })
  app_version: string | null;

  @Column({ type: 'varchar', name: 'os_name', length: 50, nullable: true })
  os_name: string | null;

  @Column({ type: 'varchar', name: 'os_version', length: 50, nullable: true })
  os_version: string | null;

  @CreateDateColumn({
    type: 'datetime',
    name: 'createdAt',
    nullable: false,
  })
  createdAt: Date;

  @ManyToOne(() => UserEntity, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;
}
