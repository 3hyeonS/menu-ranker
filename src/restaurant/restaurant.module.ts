import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/entity/user/user.entity';
import { JwtStrategy } from '../auth/jwt.startegy';
import { MenuEntity } from '../home/entity/menu.entity';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, MenuEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule,
  ],
  controllers: [RestaurantController],
  providers: [RestaurantService, JwtStrategy],
})
export class RestaurantModule {}
