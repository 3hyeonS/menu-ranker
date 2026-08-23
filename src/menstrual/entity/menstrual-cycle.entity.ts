import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MenstrualRecordEntity } from './menstrual-record.entity';

@Entity('menstrual_cycle')
@Index('IDX_menstrual_cycle_user_start', ['user', 'startDate'])
export class MenstrualCycleEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate: string;

  @Column({ type: 'boolean', name: 'is_end', default: false })
  isEnd: boolean;

  @ManyToOne(() => UserEntity, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @OneToMany(() => MenstrualRecordEntity, (record) => record.cycle, {
    cascade: true,
  })
  records: MenstrualRecordEntity[];

  @CreateDateColumn({
    type: 'datetime',
    precision: 6,
    name: 'createdAt',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'datetime',
    precision: 6,
    name: 'updatedAt',
  })
  updatedAt: Date;
}
