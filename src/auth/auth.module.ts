import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entity/user/user.entity';
import { AuthorityEntity } from './entity/authority.entity';
import { KakaoKeyEntity } from './entity/user/kakaoKey.entity';
import { AppleKeyEntity } from './entity/user/appleKey.entity';
import { SignWithEntity } from './entity/user/signWith.entity';
import { RefreshTokenEntity } from './entity/refreshToken.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { CommonAuthController } from './controllers/commonAuth.controller';
import { AdminAuthController } from './controllers/adminAuth.controller';
import { UserAuthController } from './controllers/userAuth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.startegy';
import { AppleStrategy } from './apple.startegy';
import { KakaoAppStrategy } from './kakao.strategy';
import * as dotenv from 'dotenv';
import { Module } from '@nestjs/common';
import { UserInfoEntity } from './entity/user/userInfo.entity';
import { MealEntity } from '../home/entity/meal.entity';
import { MealMenuEntity } from '../home/entity/meal-menu.entity';
import { WeightStepsEntity } from '../home/entity/weight-steps.entity';
import { MenuEntity } from '../home/entity/menu.entity';
import { BrandAddEntity } from '../home/entity/brand-add.entity';
import { UserGoalEntity } from './entity/user/userGoal.entity';
import { SubscriptionCodeEntity } from './entity/subscription-code.entity';
import { UserSubscriptionEntity } from './entity/user-subscription.entity';
import { SubscriptionService } from './subscription.service';

// .env 파일 로드
dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AuthorityEntity,
      KakaoKeyEntity,
      AppleKeyEntity,
      SignWithEntity,
      RefreshTokenEntity,
      UserInfoEntity,
      MealEntity,
      MealMenuEntity,
      WeightStepsEntity,
      MenuEntity,
      BrandAddEntity,
      UserGoalEntity,
      SubscriptionCodeEntity,
      UserSubscriptionEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule,
    HttpModule,
  ],
  controllers: [CommonAuthController, AdminAuthController, UserAuthController],
  providers: [
    AuthService,
    SubscriptionService,
    JwtStrategy,
    AppleStrategy,
    KakaoAppStrategy,
  ],
  exports: [AuthService, SubscriptionService, JwtModule, PassportModule],
})
export class AuthModule {}
