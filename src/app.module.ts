import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { HomeModule } from './home/home.module';
import { ChatModule } from './chat/chat.module';
import { ProfileModule } from './profile/profile.module';
import { MenstrualModule } from './menstrual/menstrual.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    AuthModule,
    HomeModule,
    ChatModule,
    ProfileModule,
    MenstrualModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
