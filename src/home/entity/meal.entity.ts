import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
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
