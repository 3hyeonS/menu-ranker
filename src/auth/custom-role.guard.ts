import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles-decorator';
import { TRole } from './entity/authority.entity';
import { UserEntity } from './entity/user/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 핸들러 또는 클래스에 설정된 역할을 가져오기
    const requiredRoles = this.reflector.getAllAndOverride<TRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 설정된 역할이 없는(==권한설정을 하지 않은) 핸들러는 기본적으로 true를 반환해 접근을 허용
    if (!requiredRoles) {
      return true;
    }

    // 요청 객체에서 사용자 정보를 가져오기
    const { user }: { user: UserEntity } = context.switchToHttp().getRequest();

    // 사용자가 없을 경우 true 반환 (optionalUser 비로그인 처리)
    if (!user) {
      return true;
    }

    // 사용자의 역할이 필요한 역할 목록에 포함되는지 권한 확인
    const hasRole = requiredRoles.some((role) => user.authority.role === role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Not a member of the ${requiredRoles} (only ${requiredRoles} can call this api)`,
      );
    }
    return true;
  }
}
