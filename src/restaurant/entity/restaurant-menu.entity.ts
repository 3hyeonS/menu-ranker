import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RestaurantEntity } from './restaurant.entity';

@Entity('restaurant_menu')
export class RestaurantMenuEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int', name: 'restaurant_id' })
  restaurantId: number;

  @ManyToOne(() => RestaurantEntity, (restaurant) => restaurant.menus, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'menu_category',
    nullable: true,
  })
  menuCategory: string | null;

  @Column({ type: 'tinyint' })
  unit: number;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  weight: number;

  @Column({ type: 'varchar', length: 50, name: 'unit_quantity' })
  unitQuantity: string;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  calories: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  carbs: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  sugars: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 3,
    name: 'sugar_alcohol',
    nullable: true,
  })
  sugarAlcohol: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 3,
    name: 'dietary_fiber',
    nullable: true,
  })
  dietaryFiber: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  protein: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  fat: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 3,
    name: 'sat_fat',
    nullable: true,
  })
  satFat: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 3,
    name: 'trans_fat',
    nullable: true,
  })
  transFat: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 3,
    name: 'unsat_fat',
    nullable: true,
  })
  unsatFat: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  sodium: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  caffeine: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  potassium: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  cholesterol: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  alcohol: number | null;

  @Column({ type: 'char', length: 64, name: 'source_key', unique: true })
  sourceKey: string;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
