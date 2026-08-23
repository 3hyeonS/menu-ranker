import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import * as dotenv from 'dotenv';
import { Module } from '@nestjs/common';
import { MealEntity } from '../home/entity/meal.entity';
import { MealMenuEntity } from '../home/entity/meal-menu.entity';
import { MenuEntity } from '../home/entity/menu.entity';
import { UserEntity } from '../auth/entity/user/user.entity';
import { UserInfoEntity } from '../auth/entity/user/userInfo.entity';
import { JwtStrategy } from '../auth/jwt.startegy';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatHistoryEntity } from './entity/chat-history.entity';
import { ChatConversationSessionEntity } from './entity/chat-conversation-session.entity';
import { ChatUserMemoryEntity } from './entity/chat-user-memory.entity';
import { VectorModule } from '../vector/vector.module';
import { MenuSetEntity } from '../home/entity/menu-set.entity';
import { WorkoutRecordEntity } from '../home/entity/workout-record.entity';

// .env 파일 로드
dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserInfoEntity,
      MealEntity,
      MealMenuEntity,
      MenuEntity,
      MenuSetEntity,
      ChatHistoryEntity,
      ChatConversationSessionEntity,
      ChatUserMemoryEntity,
      WorkoutRecordEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule,
    HttpModule,
    VectorModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, JwtStrategy],
  exports: [ChatService, JwtModule, PassportModule],
})
export class ChatModule {}
