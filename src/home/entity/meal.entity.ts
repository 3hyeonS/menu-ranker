import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MealMenuEntity } from './meal-menu.entity';

@Entity('meal')
export class MealEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'datetime', name: 'date', nullable: false })
  date: Date;

  @Column({ type: 'tinyint', name: 'time', nullable: false })
  time: number;

  @Column({ type: 'varchar', name: 'image', nullable: true })
  image: string;

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

  @OneToMany(() => MealMenuEntity, (mealMenu) => mealMenu.meal, {
    nullable: false,
    cascade: true,
  })
  mealMenus: MealMenuEntity[];

  @ManyToOne(() => UserEntity, (user) => user.meal, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;
}
