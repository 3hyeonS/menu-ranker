import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user/user.entity';
import { SubscriptionCodeEntity } from './subscription-code.entity';

export type UserSubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED';

@Entity({ name: 'user_subscription' })
export class UserSubscriptionEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({
    type: 'varchar',
    name: 'status',
    nullable: false,
    default: 'ACTIVE',
  })
  status: UserSubscriptionStatus;

  @Column({ type: 'datetime', name: 'starts_at', nullable: false })
  starts_at: Date;

  @Column({ type: 'datetime', name: 'expires_at', nullable: false })
  expires_at: Date;

  @CreateDateColumn({
    type: 'datetime',
    name: 'createdAt',
    nullable: false,
  })
  createdAt: Date;

  @ManyToOne(() => UserEntity, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(
    () => SubscriptionCodeEntity,
    (subscriptionCode) => subscriptionCode.userSubscriptions,
    {
      nullable: false,
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'subscriptionCodeId' })
  subscriptionCode: SubscriptionCodeEntity;
}
