import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkoutRecordEntity } from './workout-record.entity';

export type WorkoutType = 'cardio' | 'weight';

@Entity('workout')
export class WorkoutEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'varchar', length: 255, name: 'name', nullable: false })
  name: string;

  @Column({ type: 'varchar', name: 'image', nullable: true })
  image: string | null;

  @Column({ type: 'varchar', name: 'gif', nullable: true })
  gif: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'workout_type',
    nullable: false,
  })
  workout_type: WorkoutType;

  @Column({ type: 'float', name: 'met', nullable: true })
  met: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'body_part_major',
    nullable: true,
  })
  body_part_major: string | null;

  @Column({ type: 'simple-json', name: 'body_part_minor', nullable: true })
  body_part_minor: string[] | null;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'equipment_category',
    nullable: true,
  })
  equipment_category: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'equipment_detail',
    nullable: true,
  })
  equipment_detail: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'equipment_original_detail',
    nullable: true,
  })
  equipment_original_detail: string | null;

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

  @OneToMany(() => WorkoutRecordEntity, (record) => record.workout)
  records: WorkoutRecordEntity[];
}
