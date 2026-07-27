import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { singleDecimalTransformer } from '../../utils/number.util';
import { WorkoutEntity, WorkoutType } from './workout.entity';
import { WorkoutRecordSetEntity } from './workout-record-set.entity';

@Entity('workout_record')
export class WorkoutRecordEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'date', name: 'date', nullable: false })
  date: string;

  @Column({
    type: 'float',
    name: 'workout_duration',
    nullable: false,
    transformer: singleDecimalTransformer,
  })
  workout_duration: number;

  @Column({
    type: 'float',
    name: 'burned_calories',
    nullable: false,
    transformer: singleDecimalTransformer,
  })
  burned_calories: number;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'workout_type',
    nullable: false,
  })
  workout_type: WorkoutType;

  @Column({ type: 'tinyint', name: 'intensity', nullable: true })
  intensity: number | null;

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

  @ManyToOne(() => UserEntity, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @ManyToOne(() => WorkoutEntity, (workout) => workout.records, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  workout: WorkoutEntity;

  @OneToMany(() => WorkoutRecordSetEntity, (set) => set.workoutRecord, {
    cascade: true,
  })
  setList: WorkoutRecordSetEntity[];
}
