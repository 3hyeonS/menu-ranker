import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { singleDecimalTransformer } from '../../utils/number.util';
import { MenuSetEntity } from './menu-set.entity';
import { MenuEntity } from './menu.entity';

@Entity('menu_set_menu')
export class MenuSetMenuEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @ManyToOne(() => MenuSetEntity, (menuSet) => menuSet.setMenus, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  menuSet: MenuSetEntity;

  @ManyToOne(() => MenuEntity, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  menu: MenuEntity;

  @Column({
    type: 'float',
    name: 'quantity',
    nullable: false,
    transformer: singleDecimalTransformer,
  })
  quantity: number;

  @Column({
    type: 'tinyint',
    name: 'menu_input_mode',
    nullable: false,
    default: 0,
  })
  menu_input_mode: number;

  @Column({
    type: 'int',
    name: 'sort_order',
    nullable: false,
    default: 0,
  })
  sort_order: number;
}
