import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuEntity } from '../home/entity/menu.entity';
import { MealMenuEntity } from '../home/entity/meal-menu.entity';
import { VectorModule } from '../vector/vector.module';
import { FoodImageMenuCatalog } from './food-image-menu-catalog';
import { FoodImageMenuMatcher } from './food-image-menu-matcher';

// Home·Chat 모듈이 import한다. provider는 앱 전체에서 하나라 공용 메뉴 캐시도 하나다.
@Module({
  imports: [
    TypeOrmModule.forFeature([MenuEntity, MealMenuEntity]),
    VectorModule,
  ],
  providers: [FoodImageMenuCatalog, FoodImageMenuMatcher],
  exports: [FoodImageMenuCatalog, FoodImageMenuMatcher],
})
export class FoodImageModule {}
