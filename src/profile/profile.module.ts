import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import * as dotenv from 'dotenv';
import { UserEntity } from '../auth/entity/user/user.entity';
import { UserInfoEntity } from '../auth/entity/user/userInfo.entity';
import { JwtStrategy } from '../auth/jwt.startegy';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { InquiryEntity } from './entity/inquiry.entity';
import { ProfileRatioSumTo100Constraint } from './dto/request-dto/update-target-ratio-request-dto';
import { UserGoalEntity } from '../auth/entity/user/userGoal.entity';
import { AuthModule } from '../auth/auth.module';

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserInfoEntity,
      InquiryEntity,
      UserGoalEntity,
    ]),
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService, JwtStrategy, ProfileRatioSumTo100Constraint],
  exports: [ProfileService, JwtModule, PassportModule],
})
export class ProfileModule {}
