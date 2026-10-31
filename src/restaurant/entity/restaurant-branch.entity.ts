import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RestaurantEntity } from './restaurant.entity';

/**
 * 카카오 장소(지점) 단위 식당. 프랜차이즈 지점이면 브랜드 `restaurant`를 가리키고,
 * 개인 식당이거나 매칭이 풀리면 `restaurant_id`가 NULL이다.
 * `restaurant:import`가 restaurant를 지우면 SET NULL되므로 `restaurant:branch-import`를 다시 실행한다.
 */
@Entity('restaurant_branch')
export class RestaurantBranchEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  // 카카오 로컬 API 응답의 `id`(숫자 문자열).
  @Index('UQ_restaurant_branch_kakao_place_id', { unique: true })
  @Column({ type: 'varchar', length: 20, name: 'kakao_place_id' })
  kakaoPlaceId: string;

  @Index('IDX_restaurant_branch_restaurant')
  @Column({ type: 'int', name: 'restaurant_id', nullable: true })
  restaurantId: number | null;

  @ManyToOne(() => RestaurantEntity, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'restaurant_id',
    foreignKeyConstraintName: 'FK_restaurant_branch_restaurant',
  })
  restaurant: RestaurantEntity | null;

  @Column({ type: 'varchar', length: 255, name: 'place_name' })
  placeName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'kakao_category',
    nullable: true,
  })
  kakaoCategory: string | null;

  // 브랜드 매칭 근거: 'category'(카카오 카테고리) 또는 'name'(장소명 첫 단어).
  @Column({ type: 'varchar', length: 20, name: 'match_source', nullable: true })
  matchSource: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
