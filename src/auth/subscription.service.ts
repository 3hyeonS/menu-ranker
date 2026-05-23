import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { UserEntity } from './entity/user/user.entity';
import { UserInfoEntity } from './entity/user/userInfo.entity';
import { SubscriptionCodeEntity } from './entity/subscription-code.entity';
import { UserSubscriptionEntity } from './entity/user-subscription.entity';
import { CreateSubscriptionCodeRequestDto } from './dto/subscription-code-dto/request-dto/create-subscription-code-request-dto';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserSubscriptionEntity)
    private readonly userSubscriptionRepository: Repository<UserSubscriptionEntity>,
  ) {}

  normalizeCode(code: string): string {
    return code.trim().replace(/\s+/g, '').toUpperCase();
  }

  async validateSubscriptionCode(rawCode: string): Promise<void> {
    const code = this.normalizeCode(rawCode ?? '');

    if (!code) {
      throw new BadRequestException('subCode must not be empty');
    }

    const subscriptionCode = await this.dataSource.manager.findOne(
      SubscriptionCodeEntity,
      {
        where: { code },
      },
    );

    if (!subscriptionCode) {
      throw new NotFoundException('Subscription code not found');
    }

    const now = new Date();

    if (
      subscriptionCode.status !== 'ACTIVE' ||
      (subscriptionCode.starts_at && subscriptionCode.starts_at > now) ||
      (subscriptionCode.expires_at && subscriptionCode.expires_at < now)
    ) {
      throw new BadRequestException('Subscription code is not active');
    }

    if (subscriptionCode.used_count >= subscriptionCode.max_uses) {
      throw new ConflictException('Subscription code usage limit exceeded');
    }
  }

  async createSubscriptionCode(
    dto: CreateSubscriptionCodeRequestDto,
  ): Promise<SubscriptionCodeEntity> {
    const code = this.normalizeCode(dto.code);

    if (!code) {
      throw new BadRequestException('code must not be empty');
    }

    const existingCode = await this.dataSource.manager.findOne(
      SubscriptionCodeEntity,
      {
        where: { code },
      },
    );

    if (existingCode) {
      throw new ConflictException('Subscription code already exists');
    }

    const startsAt = dto.starts_at ? new Date(dto.starts_at) : null;
    const expiresAt = dto.expires_at ? new Date(dto.expires_at) : null;

    if (startsAt && expiresAt && startsAt >= expiresAt) {
      throw new BadRequestException('expires_at must be after starts_at');
    }

    return await this.dataSource.manager.save(
      this.dataSource.manager.create(SubscriptionCodeEntity, {
        code,
        type: dto.type ?? 'PROMOTION',
        status: 'ACTIVE',
        max_uses: dto.max_uses ?? 1,
        used_count: 0,
        starts_at: startsAt,
        expires_at: expiresAt,
        benefit_days: dto.benefit_days ?? 30,
      }),
    );
  }

  async authorizeSubscriptionCode(
    user: UserEntity,
    rawCode: string,
  ): Promise<UserSubscriptionEntity> {
    const code = this.normalizeCode(rawCode ?? '');

    if (!code) {
      throw new BadRequestException('subCode must not be empty');
    }

    return await this.dataSource.transaction(async (manager) => {
      const subscriptionCode = await manager.findOne(SubscriptionCodeEntity, {
        where: { code },
        lock: { mode: 'pessimistic_write' },
      });

      if (!subscriptionCode) {
        throw new NotFoundException('Subscription code not found');
      }

      const now = new Date();

      if (
        subscriptionCode.status !== 'ACTIVE' ||
        (subscriptionCode.starts_at && subscriptionCode.starts_at > now) ||
        (subscriptionCode.expires_at && subscriptionCode.expires_at < now)
      ) {
        throw new BadRequestException('Subscription code is not active');
      }

      if (subscriptionCode.used_count >= subscriptionCode.max_uses) {
        throw new ConflictException('Subscription code usage limit exceeded');
      }

      const alreadyUsed = await manager.findOne(UserSubscriptionEntity, {
        where: {
          user: { id: user.id },
          subscriptionCode: { id: subscriptionCode.id },
        },
      });

      if (alreadyUsed) {
        throw new ConflictException('Your subCode already exists');
      }

      const activeSubscription = await manager.findOne(UserSubscriptionEntity, {
        where: {
          user: { id: user.id },
          status: 'ACTIVE',
          expires_at: MoreThan(now),
        },
        order: {
          expires_at: 'DESC',
          id: 'DESC',
        },
      });
      const startsAt =
        activeSubscription && activeSubscription.expires_at > now
          ? activeSubscription.expires_at
          : now;
      const expiresAt = new Date(startsAt);
      expiresAt.setDate(expiresAt.getDate() + subscriptionCode.benefit_days);

      const userSubscription = await manager.save(
        manager.create(UserSubscriptionEntity, {
          status: 'ACTIVE',
          starts_at: startsAt,
          expires_at: expiresAt,
          user,
          subscriptionCode,
        }),
      );

      subscriptionCode.used_count += 1;
      if (subscriptionCode.used_count >= subscriptionCode.max_uses) {
        subscriptionCode.status = 'USED';
      }
      await manager.save(subscriptionCode);

      const userInfo = await manager.findOne(UserInfoEntity, {
        where: { user: { id: user.id } },
      });

      if (userInfo) {
        userInfo.subCode = code;
        await manager.save(userInfo);
      }

      return userSubscription;
    });
  }

  async hasActiveSubscription(userId: number): Promise<boolean> {
    const activeSubscription = await this.userSubscriptionRepository.findOne({
      where: {
        user: { id: userId },
        status: 'ACTIVE',
        expires_at: MoreThan(new Date()),
      },
    });

    return !!activeSubscription;
  }
}
