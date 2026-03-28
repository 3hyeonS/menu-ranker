import { UserEntity } from '../../auth/entity/user/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { singleDecimalTransformer } from '../../utils/number.util';

@Entity('weight_steps')
export class WeightStepsEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'datetime', name: 'date', nullable: false })
  date: Date;

  @Column({
    type: 'float',
    name: 'weight',
    nullable: true,
    transformer: singleDecimalTransformer,
  })
  weight: number;

  @Column({
    type: 'float',
    name: 'steps',
    nullable: true,
    transformer: singleDecimalTransformer,
  })
  steps: number;

  @ManyToOne(() => UserEntity, (user) => user.weight_steps, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;
}
