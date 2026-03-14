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

@Entity('user_info')
export class UserInfoEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'tinyint', name: 'gender', nullable: false })
  gender: number;

  @Column({ type: 'int', name: 'birthYear', nullable: false })
  birthYear: number;

  @Column({ type: 'float', name: 'height', nullable: false })
  height: number;

  @Column({ type: 'float', name: 'weight', nullable: false })
  weight: number;

  @Column({ type: 'tinyint', name: 'activity', nullable: false })
  activity: number;

  @Column({ type: 'tinyint', name: 'goal', nullable: false })
  goal: number;

  @Column({ type: 'float', name: 'target_weight', nullable: false })
  target_weight: number;

  @Column({ type: 'int', name: 'target_calories', nullable: false })
  target_calories: number;

  @Column({ type: 'json', name: 'target_ratio', nullable: false })
  target_ratio: number[];

  @Column({ type: 'varchar', name: 'subCode', nullable: true, unique: true })
  subCode: string;

  @OneToOne(() => UserEntity, (user) => user.userInfo, {
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
