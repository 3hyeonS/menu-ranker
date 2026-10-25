import { AuthService } from './auth.service';
import { SubscriptionService } from './subscription.service';
import { UserInfoEntity } from './entity/user/userInfo.entity';
import { UserGoalEntity } from './entity/user/userGoal.entity';

const user = { id: 4, nickname: 'n', name: 'm', email: 'e@x.com' } as any;
const dto = {
  gender: 0,
  birthYear: 1995,
  height: 170.04,
  weight: 60.06,
  activity: 1,
  goal: 0,
  target_weight: 55.01,
  target_calories: 1800,
  target_ratio: [50, 30, 20],
  subCode: ' promo 1 ',
} as any;

function createAuthService() {
  const txUserInfoRepository = {
    save: jest.fn(async (value) => ({ id: 1, ...value })),
  };
  const txUserGoalRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === UserInfoEntity) return txUserInfoRepository;
      if (entity === UserGoalEntity) return txUserGoalRepository;
      throw new Error('unexpected repository');
    }),
  };
  const service = Object.create(AuthService.prototype) as any;
  service.userInfoRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    manager: { transaction: jest.fn((work) => work(manager)) },
  };
  service.userGoalRepository = { create: jest.fn(), save: jest.fn() };
  service.subscriptionService = {
    normalizeCode: (code: string) => code.trim().replace(/\s+/g, ''),
    validateSubscriptionCode: jest.fn(),
    authorizeSubscriptionCode: jest.fn(),
    hasActiveSubscription: jest.fn().mockResolvedValue(true),
  };

  return { service, manager, txUserInfoRepository, txUserGoalRepository };
}

describe('AuthService.registerUserInfo transaction', () => {
  it('saves user_info, user_goal and the subscription code in one transaction', async () => {
    const { service, manager, txUserInfoRepository, txUserGoalRepository } =
      createAuthService();

    const response = await service.registerUserInfo(user, dto);

    expect(service.userInfoRepository.save).not.toHaveBeenCalled();
    expect(service.userGoalRepository.save).not.toHaveBeenCalled();
    expect(txUserInfoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ height: 170, weight: 60.1, subCode: null }),
    );
    expect(txUserGoalRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ target_calories: 1800, user }),
    );
    expect(
      service.subscriptionService.authorizeSubscriptionCode,
    ).toHaveBeenCalledWith(user, 'promo1', manager);
    expect(response).toEqual(
      expect.objectContaining({ subCode: 'promo1', is_subscribed: true }),
    );
  });

  it('propagates a subscription failure so user_info and user_goal roll back', async () => {
    const { service } = createAuthService();
    service.subscriptionService.authorizeSubscriptionCode.mockRejectedValue(
      new Error('usage limit exceeded'),
    );

    await expect(service.registerUserInfo(user, dto)).rejects.toThrow(
      'usage limit exceeded',
    );
    expect(
      service.userInfoRepository.manager.transaction,
    ).toHaveBeenCalledTimes(1);
    expect(
      service.subscriptionService.hasActiveSubscription,
    ).not.toHaveBeenCalled();
  });
});

describe('SubscriptionService.authorizeSubscriptionCode', () => {
  it('reuses the caller transaction manager instead of opening a new one', async () => {
    const dataSource = { transaction: jest.fn() };
    const service = new SubscriptionService(dataSource as any, {} as any);
    const subscriptionCode = {
      id: 1,
      code: 'PROMO1',
      status: 'ACTIVE',
      starts_at: null,
      expires_at: null,
      used_count: 0,
      max_uses: 1,
      benefit_days: 30,
    };
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(subscriptionCode)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2, subCode: null }),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (value) => value),
    };

    await service.authorizeSubscriptionCode(user, 'promo1', manager as any);

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, subCode: 'PROMO1' }),
    );
    expect(subscriptionCode).toEqual(
      expect.objectContaining({ used_count: 1, status: 'USED' }),
    );
  });
});
