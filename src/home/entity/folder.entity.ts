import { UserEntity } from '../../auth/entity/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FolderMenuEntity } from './folder-menu.entity';

@Entity('folder')
export class FolderEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'varchar', length: 255, name: 'name', nullable: false })
  name: string;

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

  @ManyToOne(() => UserEntity, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @OneToMany(() => FolderMenuEntity, (folderMenu) => folderMenu.folder, {
    cascade: true,
  })
  folderMenus: FolderMenuEntity[];
}
