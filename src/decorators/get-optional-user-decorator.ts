import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '../auth/entity/user/user.entity';

export const GetOptionalUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserEntity | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || null;
  },
);
