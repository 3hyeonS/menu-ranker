import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RestaurantBranchEntity } from './restaurant-branch.entity';

/**
 * 카카오 지점 메뉴(메뉴명·사진만, 영양정보 없음). #30 `## 결정` 댓글 기준.
 * `restaurant:branch-import`가 지점 단위로 지우고 다시 넣으므로 타임스탬프 컬럼을 두지 않는다.
 */
@Entity('restaurant_branch_menu')
@Index('UQ_restaurant_branch_menu_branch_order', ['branchId', 'sortOrder'], {
  unique: true,
})
export class RestaurantBranchMenuEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int', name: 'branch_id' })
  branchId: number;

  @ManyToOne(() => RestaurantBranchEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'branch_id',
    foreignKeyConstraintName: 'FK_restaurant_branch_menu_branch',
  })
  branch: RestaurantBranchEntity;

  // 카카오 표시 순서(menus.csv 안의 순서, 0부터).
  @Column({ type: 'smallint', name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // 카카오 CDN URL. 적재할 때 http://를 https://로 바꾼다.
  @Column({ type: 'varchar', length: 512, name: 'photo_url', nullable: true })
  photoUrl: string | null;
}
