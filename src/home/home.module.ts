import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';

import * as dotenv from 'dotenv';
import { Module } from '@nestjs/common';
import { UserEntity } from '../auth/entity/user/user.entity';
import { AuthorityEntity } from '../auth/entity/authority.entity';
import { RefreshTokenEntity } from '../auth/entity/refreshToken.entity';
import { UserInfoEntity } from '../auth/entity/user/userInfo.entity';
import { MenuEntity } from './entity/menu.entity';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { JwtStrategy } from '../auth/jwt.startegy';
import { MealEntity } from './entity/meal.entity';
import { MealMenuEntity } from './entity/meal-menu.entity';
import { WeightStepsEntity } from './entity/weight-steps.entity';
import { BrandAddEntity } from './entity/brand-add.entity';
import { VectorModule } from '../vector/vector.module';
import { FolderEntity } from './entity/folder.entity';
import { FolderMenuEntity } from './entity/folder-menu.entity';
import { MenuSetEntity } from './entity/menu-set.entity';
import { MenuSetMenuEntity } from './entity/menu-set-menu.entity';
import { MealSetEntity } from './entity/meal-set.entity';
import { WorkoutEntity } from './entity/workout.entity';
import { WorkoutRecordEntity } from './entity/workout-record.entity';
import { WorkoutRecordSetEntity } from './entity/workout-record-set.entity';

// .env 파일 로드
dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AuthorityEntity,
      RefreshTokenEntity,
      UserInfoEntity,
      MenuEntity,
      MealEntity,
      MealMenuEntity,
      FolderEntity,
      FolderMenuEntity,
      MenuSetEntity,
      MenuSetMenuEntity,
      MealSetEntity,
      WorkoutEntity,
      WorkoutRecordEntity,
      WorkoutRecordSetEntity,
      WeightStepsEntity,
      BrandAddEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule,
    HttpModule,
    VectorModule,
  ],
  controllers: [HomeController],
  providers: [HomeService, JwtStrategy],
  exports: [HomeService, JwtModule, PassportModule],
})
export class HomeModule {}
