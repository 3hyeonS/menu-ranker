import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MenstrualCycleEntity } from './menstrual-cycle.entity';

export const MENSTRUAL_STATUSES = ['있음', '없음'] as const;
export type MenstrualStatus = (typeof MENSTRUAL_STATUSES)[number];

export const MENSTRUAL_FLOWS = ['적음', '보통', '많음', '매우 많음'] as const;
export type MenstrualFlow = (typeof MENSTRUAL_FLOWS)[number];

@Entity('menstrual_record')
@Index('UQ_menstrual_record_user_date', ['user', 'date'], { unique: true })
@Index('IDX_menstrual_record_cycle_date', ['cycle', 'date'])
export class MenstrualRecordEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'date', name: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 10, name: 'menstruation_status' })
  menstruationStatus: MenstrualStatus;

  @Column({ type: 'varchar', length: 20, name: 'flow', nullable: true })
  flow: MenstrualFlow | null;

  @Column({ type: 'json', name: 'symptoms', nullable: true })
  symptoms: string[] | null;

  @ManyToOne(() => MenstrualCycleEntity, (cycle) => cycle.records, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  cycle: MenstrualCycleEntity;

  @ManyToOne(() => UserEntity, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;

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
