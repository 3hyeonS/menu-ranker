import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RestaurantMenuEntity } from './restaurant-menu.entity';

@Entity('restaurant')
export class RestaurantEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'normalized_name' })
  normalizedName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string | null;

  @OneToMany(() => RestaurantMenuEntity, (menu) => menu.restaurant)
  menus: RestaurantMenuEntity[];

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
