import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserSubscriptionEntity } from './user-subscription.entity';

export type SubscriptionCodeType =
  | 'TRIAL'
  | 'PAID'
  | 'PROMOTION'
  | 'ADMIN'
  | 'TUMBLBUG';
export type SubscriptionCodeStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';

@Entity({ name: 'subscription_code' })
export class SubscriptionCodeEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'code', nullable: false, unique: true })
  code: string;

  @Column({
    type: 'varchar',
    name: 'type',
    nullable: false,
    default: 'PROMOTION',
  })
  type: SubscriptionCodeType;

  @Column({
    type: 'varchar',
    name: 'status',
    nullable: false,
    default: 'ACTIVE',
  })
  status: SubscriptionCodeStatus;

  @Column({ type: 'int', name: 'max_uses', nullable: false, default: 1 })
  max_uses: number;

  @Column({ type: 'int', name: 'used_count', nullable: false, default: 0 })
  used_count: number;

  @Column({ type: 'datetime', name: 'starts_at', nullable: true })
  starts_at: Date | null;

  @Column({ type: 'datetime', name: 'expires_at', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'int', name: 'benefit_days', nullable: false, default: 30 })
  benefit_days: number;

  @CreateDateColumn({
    type: 'datetime',
    name: 'createdAt',
    nullable: false,
  })
  createdAt: Date;

  @OneToMany(
    () => UserSubscriptionEntity,
    (userSubscription) => userSubscription.subscriptionCode,
  )
  userSubscriptions: UserSubscriptionEntity[];
}
