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

@Entity('water_intake')
@Index('UQ_water_intake_user_date', ['user', 'date'], { unique: true })
export class WaterIntakeEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'date', name: 'date', nullable: false })
  date: string;

  @Column({ type: 'int', name: 'amount_ml', nullable: false })
  amountMl: number;

  @ManyToOne(() => UserEntity, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @CreateDateColumn({ type: 'datetime', precision: 6, name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6, name: 'updatedAt' })
  updatedAt: Date;
}
