import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SignWithEntity } from './signWith.entity';
import { KakaoKeyEntity } from './kakaoKey.entity';
import { AppleKeyEntity } from './appleKey.entity';
import { AuthorityEntity } from '../authority.entity';
import { RefreshTokenEntity } from '../refreshToken.entity';
import { UserInfoEntity } from './userInfo.entity';
import { MenuEntity } from '../../../home/entity/menu.entity';
import { MealEntity } from '../../../home/entity/meal.entity';
import { WeightStepsEntity } from '../../../home/entity/weight-steps.entity';

@Entity({ name: 'user' })
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'nickname', nullable: false })
  nickname: string;

  @Column({ type: 'varchar', name: 'email', nullable: false })
  email: string;

  @ManyToOne(() => SignWithEntity, (signWith) => signWith.platform, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  signWith: SignWithEntity;

  @OneToOne(() => KakaoKeyEntity, (kakaoKey) => kakaoKey.user, {
    eager: true,
    cascade: true,
    nullable: true,
  })
  kakaoKey: KakaoKeyEntity;

  @OneToOne(() => AppleKeyEntity, (appleKey) => appleKey.user, {
    eager: true,
    cascade: true,
    nullable: true,
  })
  appleKey: AppleKeyEntity;

  @ManyToOne(() => AuthorityEntity, (authority) => authority.role, {
    eager: true,
    nullable: false,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  authority: AuthorityEntity;

  @CreateDateColumn({
    type: 'datetime',
    name: 'createdAt',
    nullable: false,
  })
  createdAt: Date;

  @OneToMany(() => RefreshTokenEntity, (refreshToken) => refreshToken.user, {
    nullable: true,
    cascade: true,
  })
  refreshTokens: RefreshTokenEntity[];

  @OneToOne(() => UserInfoEntity, (userInfo) => userInfo.user, {
    eager: true,
    cascade: true,
    nullable: true,
  })
  userInfo: UserInfoEntity;

  @OneToMany(() => MenuEntity, (menu) => menu.user, {
    nullable: true,
    cascade: true,
  })
  registered_menu: MenuEntity[];

  @OneToMany(() => MealEntity, (meal) => meal.user, {
    nullable: true,
    cascade: true,
  })
  meal: MealEntity[];

  @OneToMany(() => WeightStepsEntity, (weight_steps) => weight_steps.user, {
    nullable: true,
    cascade: true,
  })
  weight_steps: WeightStepsEntity[];
}
