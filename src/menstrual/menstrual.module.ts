import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '../auth/jwt.startegy';
import { UserEntity } from '../auth/entity/user/user.entity';
import { MenstrualCycleEntity } from './entity/menstrual-cycle.entity';
import { MenstrualRecordEntity } from './entity/menstrual-record.entity';
import { MenstrualController } from './menstrual.controller';
import { MenstrualService } from './menstrual.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      MenstrualCycleEntity,
      MenstrualRecordEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule,
  ],
  controllers: [MenstrualController],
  providers: [MenstrualService, JwtStrategy],
  exports: [MenstrualService],
})
export class MenstrualModule {}
