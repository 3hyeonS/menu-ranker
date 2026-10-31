import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../chat/chat.module';
import { RestaurantBranchEntity } from './entity/restaurant-branch.entity';
import { RestaurantMenuEntity } from './entity/restaurant-menu.entity';
import { RestaurantEntity } from './entity/restaurant.entity';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RestaurantEntity,
      RestaurantMenuEntity,
      RestaurantBranchEntity,
    ]),
    ChatModule,
  ],
  controllers: [RestaurantController],
  providers: [RestaurantService],
})
export class RestaurantModule {}
