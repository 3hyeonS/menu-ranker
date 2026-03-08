import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

@Injectable()
export class KakaoAppStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor() {
    super({
      clientID: process.env.KAKAO_CLIENT_ID,
      callbackURL: process.env.KAKAO_CALLBACK_URL,
      // clientSecret: process.env.KAKAO_CLIENT_SECRET,
    });
  }
}

export class KakaoWebStrategy extends PassportStrategy(Strategy, 'kakao-web') {
  constructor() {
    super({
      clientID: process.env.KAKAO_CLIENT_ID,
      callbackURL: process.env.KAKAO_CALLBACK_URL_WEB,
      // clientSecret: process.env.KAKAO_CLIENT_SECRET,
    });
  }
}
