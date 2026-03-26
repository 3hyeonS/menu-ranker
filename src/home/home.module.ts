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
      WeightStepsEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule,
    HttpModule,
  ],
  controllers: [HomeController],
  providers: [HomeService, JwtStrategy],
  exports: [HomeService, HomeModule, JwtModule, PassportModule],
})
export class HomeModule {}
