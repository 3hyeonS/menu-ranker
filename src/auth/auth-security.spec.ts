import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import appleSignin from 'apple-signin-auth';
import { AdminAuthController } from './controllers/adminAuth.controller';
import { HomeController } from '../home/home.controller';
import { RolesGuard } from './custom-role.guard';
import { ROLES_KEY } from '../decorators/roles-decorator';
import { AuthService } from './auth.service';
import { TRole } from './entity/authority.entity';
import { UserEntity } from './entity/user/user.entity';

function contextFor(
  handler: (...args: never[]) => unknown,
  cls: unknown,
  role: TRole,
) {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user: { authority: { role } } }),
    }),
  } as unknown as ExecutionContext;
}

describe('ADMIN-only routes', () => {
  const adminRoutes: [string, unknown, (...args: never[]) => unknown][] = [
    [
      'POST /adminAuth/signup',
      AdminAuthController,
      AdminAuthController.prototype.adminSignUp,
    ],
    [
      'POST /adminAuth/subscriptionCodes',
      AdminAuthController,
      AdminAuthController.prototype.createSubscriptionCode,
    ],
    [
      'POST /adminAuth/subscriptionCodes/bulk',
      AdminAuthController,
      AdminAuthController.prototype.createSubscriptionCodes,
    ],
    [
      'POST /home/importMenusCsv',
      HomeController,
      HomeController.prototype.importMenusCsv,
    ],
    [
      'POST /home/importWorkoutsCsv',
      HomeController,
      HomeController.prototype.importWorkoutsCsv,
    ],
  ];

  it.each(adminRoutes)(
    '%s requires a JWT and the ADMIN role',
    (_name, cls, handler) => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, handler);
      expect(guards).toHaveLength(2);
      expect(guards[1]).toBe(RolesGuard);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN']);

      const guard = new RolesGuard(new Reflector());
      expect(guard.canActivate(contextFor(handler, cls, 'ADMIN'))).toBe(true);
      for (const role of ['USER', 'TESTER'] as TRole[]) {
        expect(() => guard.canActivate(contextFor(handler, cls, role))).toThrow(
          ForbiddenException,
        );
      }
    },
  );

  it('keeps menuDetail public without a guard', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, HomeController.prototype.menuDetail),
    ).toBeUndefined();
  });

  it('rejects ADMIN routes when no authenticated user is attached', () => {
    const handler = AdminAuthController.prototype.adminSignUp;
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => handler,
      getClass: () => AdminAuthController,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('always rejects admin sign-in', () => {
    const controller = new AdminAuthController({} as never, {} as never);
    expect(() => controller.adminSignIn()).toThrow(
      new ForbiddenException('Admin sign-in is disabled'),
    );
  });
});

describe('AuthService token and Apple security', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.REFRESH_SECRET = 'test-refresh-secret';
    process.env.REFRESH_EXPIRATION = '7d';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function createService() {
    const service = Object.create(AuthService.prototype) as any;
    service.jwtService = new JwtService();
    service.refreshTokenRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
    return service;
  }

  it('issues distinct refresh tokens within the same second', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-25T00:00:00Z') });
    try {
      const service = createService();
      const member = Object.assign(new UserEntity(), {
        id: 1,
        email: 'user@example.com',
        authority: { role: 'USER' },
      });

      const first = await service.generateRefreshToken(member);
      const second = await service.generateRefreshToken(member);

      expect(first).not.toBe(second);
      const payload = service.jwtService.decode(first);
      expect(payload).toEqual(
        expect.objectContaining({
          id: 1,
          email: 'user@example.com',
          role: 'USER',
          jti: expect.any(String),
        }),
      );
      expect(payload.jti).toHaveLength(8);
      expect(service.refreshTokenRepository.save).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses the verified Apple identity-token email, not the client email', async () => {
    jest.spyOn(appleSignin, 'verifyIdToken').mockResolvedValue({
      sub: 'apple-sub',
      email: 'verified@privaterelay.appleid.com',
    } as never);
    jest.spyOn(appleSignin, 'getClientSecret').mockReturnValue('secret');
    jest
      .spyOn(appleSignin, 'getAuthorizationToken')
      .mockResolvedValue({ refresh_token: 'apple-refresh' } as never);

    const service = createService();
    const user = { id: 7, authority: { role: 'USER' } } as UserEntity;
    service.signUpWithApple = jest.fn().mockResolvedValue(user);
    service.generateAccessToken = jest.fn().mockResolvedValue('access');
    service.generateRefreshToken = jest.fn().mockResolvedValue('refresh');
    service.subscriptionService = {
      hasActiveSubscription: jest.fn().mockResolvedValue(false),
    };

    await service.signInWithApple({
      id_token: 'id-token',
      code: 'code',
      user: JSON.stringify({
        email: 'psa0020@kakao.com',
        name: { firstName: '길동', lastName: '홍' },
      }),
    });

    expect(service.signUpWithApple).toHaveBeenCalledWith(
      '홍길동',
      'verified@privaterelay.appleid.com',
      'apple-sub',
      'apple-refresh',
    );
  });

  it('decides the auto-admin role from the email it is given', () => {
    const service = createService();
    expect(service.resolveSignUpRoleByEmail('PSA0020@kakao.com ')).toBe(
      'ADMIN',
    );
    expect(service.resolveSignUpRoleByEmail('')).toBe('USER');
  });
});
