import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MealEntity } from './meal.entity';
import { MenuSetEntity } from './menu-set.entity';

@Entity('meal_set')
export class MealSetEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @ManyToOne(() => MealEntity, (meal) => meal.mealSets, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  meal: MealEntity;

  @ManyToOne(() => MenuSetEntity, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  menuSet: MenuSetEntity;

  @Column({
    type: 'int',
    name: 'sort_order',
    nullable: false,
    default: 0,
  })
  sort_order: number;
}
