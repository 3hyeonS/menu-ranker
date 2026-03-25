import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { MealMenuEntity } from './meal-menu.entity';

@Entity('menu')
export class MenuEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'tinyint', name: 'data_source', nullable: false })
  data_source: number;

  @Column({ type: 'varchar', name: 'name', nullable: false })
  name: string;

  @Column({ type: 'varchar', name: 'brand', nullable: true })
  brand: string;

  @Column({ type: 'varchar', name: 'category', nullable: true })
  category: string;

  @Column({ type: 'tinyint', name: 'unit', nullable: false })
  unit: number;

  @Column({ type: 'float', name: 'weight', nullable: false })
  weight: number;

  @Column({ type: 'varchar', name: 'unit_quantity', nullable: false })
  unit_quantity: string;

  @Column({ type: 'float', name: 'calories', nullable: false })
  calories: number;

  @Column({ type: 'float', name: 'carbs', nullable: true })
  carbs: number;

  @Column({ type: 'float', name: 'sugars', nullable: true })
  sugars: number;

  @Column({ type: 'float', name: 'sugar_alchol', nullable: true })
  sugar_alchol: number;

  @Column({ type: 'float', name: 'dietary_fiber', nullable: true })
  dietary_fiber: number;

  @Column({ type: 'float', name: 'protein', nullable: true })
  protein: number;

  @Column({ type: 'float', name: 'fat', nullable: true })
  fat: number;

  @Column({ type: 'float', name: 'sat_fat', nullable: true })
  sat_fat: number;

  @Column({ type: 'float', name: 'trans_fat', nullable: true })
  trans_fat: number;

  @Column({ type: 'float', name: 'un_sat_fat', nullable: true })
  un_sat_fat: number;

  @Column({ type: 'float', name: 'sodium', nullable: true })
  sodium: number;

  @Column({ type: 'float', name: 'caffeine', nullable: true })
  caffeine: number;

  @Column({ type: 'float', name: 'potassium', nullable: true })
  potassium: number;

  @Column({ type: 'float', name: 'cholesterol', nullable: true })
  cholesterol: number;

  @Column({ type: 'float', name: 'alcohol', nullable: true })
  alcohol: number;

  @OneToMany(() => MealMenuEntity, (mealMenu) => mealMenu.menu, {
    nullable: true,
    cascade: true,
  })
  mealMenus: MealMenuEntity[];

  @ManyToOne(() => UserEntity, (user) => user.registered_menu, {
    eager: true,
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;
}
