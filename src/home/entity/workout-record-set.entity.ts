import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { singleDecimalTransformer } from '../../utils/number.util';
import { WorkoutRecordEntity } from './workout-record.entity';

@Entity('workout_record_set')
export class WorkoutRecordSetEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'set_order', nullable: false })
  set_order: number;

  @Column({
    type: 'float',
    name: 'weight',
    nullable: false,
    transformer: singleDecimalTransformer,
  })
  weight: number;

  @Column({ type: 'int', name: 'reps', nullable: false })
  reps: number;

  @ManyToOne(() => WorkoutRecordEntity, (record) => record.setList, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  workoutRecord: WorkoutRecordEntity;
}
