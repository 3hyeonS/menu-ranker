import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      // Authorization 헤더가 없으면 바로 통과 (비회원 접근 허용)
      return true;
    }

    try {
      const result = (await super.canActivate(context)) as boolean;
      // 인증 성공 시 request.user 세팅됨
      return result;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired accessToken');
    }
  }
}
