import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('water_setting')
export class WaterSettingEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'int', name: 'cup_size_ml', nullable: false, default: 100 })
  cupSizeMl: number;

  @OneToOne(() => UserEntity, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @CreateDateColumn({ type: 'datetime', precision: 6, name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6, name: 'updatedAt' })
  updatedAt: Date;
}
