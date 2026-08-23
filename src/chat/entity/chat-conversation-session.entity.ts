import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ChatConversationSessionSummaryStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPACTED = 'COMPACTED',
}

@Entity('chat_conversation_session')
@Index(['userId', 'lastMessageAt'])
@Index(['userId', 'summaryStatus', 'closedAt'])
@Index(['userId', 'firstHistoryId'], { unique: true })
export class ChatConversationSessionEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'userId' })
  userId: number;

  @Column({ type: 'int', name: 'firstHistoryId' })
  firstHistoryId: number;

  @Column({ type: 'int', name: 'lastHistoryId' })
  lastHistoryId: number;

  @Column({ type: 'datetime', name: 'startedAt' })
  startedAt: Date;

  @Column({ type: 'datetime', name: 'lastMessageAt' })
  lastMessageAt: Date;

  @Column({ type: 'datetime', name: 'closedAt', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'int', name: 'messageCount', default: 0 })
  messageCount: number;

  @Column({ type: 'int', name: 'summarizedMessageCount', default: 0 })
  summarizedMessageCount: number;

  @Column({ type: 'text', name: 'summary', nullable: true })
  summary: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'summaryStatus',
    default: ChatConversationSessionSummaryStatus.PENDING,
  })
  summaryStatus: ChatConversationSessionSummaryStatus;

  @Column({ type: 'datetime', name: 'summaryUpdatedAt', nullable: true })
  summaryUpdatedAt: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updatedAt' })
  updatedAt: Date;
}
