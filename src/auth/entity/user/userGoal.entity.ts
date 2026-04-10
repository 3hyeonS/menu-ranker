import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { singleDecimalTransformer } from '../../../utils/number.util';

@Entity('user_goal')
export class UserGoalEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'tinyint', name: 'activity', nullable: false })
  activity: number;

  @Column({ type: 'tinyint', name: 'goal', nullable: false })
  goal: number;

  @Column({
    type: 'float',
    name: 'target_weight',
    nullable: false,
    transformer: singleDecimalTransformer,
  })
  target_weight: number;

  @Column({ type: 'int', name: 'target_calories', nullable: false })
  target_calories: number;

  @Column({ type: 'json', name: 'target_ratio', nullable: false })
  target_ratio: number[];

  @CreateDateColumn({
    type: 'datetime',
    name: 'createdAt',
    nullable: false,
  })
  createdAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.userGoals, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;
}
