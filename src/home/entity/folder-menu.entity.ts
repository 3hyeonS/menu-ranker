import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { singleDecimalTransformer } from '../../utils/number.util';
import { FolderEntity } from './folder.entity';
import { MenuEntity } from './menu.entity';

@Entity('folder_menu')
export class FolderMenuEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @ManyToOne(() => FolderEntity, (folder) => folder.folderMenus, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  folder: FolderEntity;

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
