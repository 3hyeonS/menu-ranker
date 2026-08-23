import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('chat_user_memory')
@Index(['userId'], { unique: true })
export class ChatUserMemoryEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'userId' })
  userId: number;

  @Column({ type: 'text', name: 'profileTraits', nullable: true })
  profileTraits: string | null;

  @Column({ type: 'datetime', name: 'lastCompactedAt', nullable: true })
  lastCompactedAt: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updatedAt' })
  updatedAt: Date;
}
