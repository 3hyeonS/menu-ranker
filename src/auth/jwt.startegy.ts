import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as dotenv from 'dotenv';
import { UserEntity } from './entity/user/user.entity';

// .env 파일 로드
dotenv.config();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
  ) {
    super({
      secretOrKey: process.env.ACCESS_SECRET || 'default-secret', // 검증하기 위한 Secret Key
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Authorization 헤더에서 토큰 추출
    });
  } // [4] Secret Key로 검증 - 인스턴스 생성 자체가 Secret Key로 JWT 토큰 검증과정

  // [5] JWT에서 사용자 정보 가져오기(인증)
  async validate(payload) {
    try {
      const { id, email, role } = payload;

      let member: UserEntity;

      if (role === 'USER' || role === 'ADMIN') {
        member = await this.usersRepository.findOne({
          where: { id, email },
        });
      }

      if (!member) {
        throw new UnauthorizedException('Invalid or expired accessToken');
      }
      return member;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired accessToken');
    }
  }
}
