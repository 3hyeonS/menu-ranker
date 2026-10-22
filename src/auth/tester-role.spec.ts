import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './custom-role.guard';
import { JwtStrategy } from './jwt.startegy';
import { TRole } from './entity/authority.entity';
import { UserEntity } from './entity/user/user.entity';
import { UserInfoEntity } from './entity/user/userInfo.entity';
import { UserResponseDto } from './dto/user-dto/response-dto/user-response-dto';
import { ProfileResponseDto } from '../profile/dto/response-dto/profile-response-dto';

const tester = {
  id: 6,
  email: 'test@example.com',
  authority: { role: 'TESTER' },
  signWith: { platform: 'APPLE' },
} as UserEntity;

function context(role: TRole): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: { authority: { role } } }),
    }),
  } as unknown as ExecutionContext;
}

function guard(roles: TRole[]) {
  return new RolesGuard({
    getAllAndOverride: () => roles,
  } as unknown as Reflector);
}

describe('TESTER role', () => {
  it.each(['USER', 'TESTER', 'ADMIN'])(
    'accepts %s JWTs and returns current DB authority',
    async (role) => {
      const repository = { findOne: jest.fn().mockResolvedValue(tester) };
      const strategy = new JwtStrategy(repository as never);
      await expect(
        strategy.validate({ id: 6, email: tester.email, role }),
      ).resolves.toBe(tester);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 6, email: tester.email },
      });
    },
  );

  it('rejects unknown roles and missing accounts', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(null) };
    const strategy = new JwtStrategy(repository as never);
    await expect(strategy.validate({ id: 6, role: 'UNKNOWN' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(repository.findOne).not.toHaveBeenCalled();
    await expect(strategy.validate({ id: 6, role: 'TESTER' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows tester access to regular-user routes but not admin routes', () => {
    expect(guard(['USER']).canActivate(context('TESTER'))).toBe(true);
    expect(guard(['TESTER']).canActivate(context('TESTER'))).toBe(true);
    expect(() => guard(['ADMIN']).canActivate(context('TESTER'))).toThrow(
      ForbiddenException,
    );
    expect(() => guard(['TESTER']).canActivate(context('USER'))).toThrow(
      ForbiddenException,
    );
  });

  it('returns the real TESTER role without granting a subscription', () => {
    const login = new UserResponseDto(tester);
    const profile = new ProfileResponseDto(tester, {} as UserInfoEntity);
    for (const dto of [login, profile]) {
      expect(dto.role).toBe('TESTER');
      expect(dto.is_subscribed).toBe(false);
      expect(dto).not.toHaveProperty('is_tester');
    }
  });
});
