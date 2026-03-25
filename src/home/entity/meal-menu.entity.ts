import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { MealEntity } from './meal.entity';
import { MenuEntity } from './menu.entity';

@Entity('meal_menu')
export class MealMenuEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @ManyToOne(() => MealEntity, (meal) => meal.mealMenus, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  meal: MealEntity;

  @ManyToOne(() => MenuEntity, (menu) => menu.mealMenus, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  menu: MenuEntity;

  @Column({ type: 'int', name: 'quantity', nullable: false })
  quantity: number;
}
