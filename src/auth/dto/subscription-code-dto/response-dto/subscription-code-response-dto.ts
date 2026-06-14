import { ApiProperty } from '@nestjs/swagger';
import {
  SubscriptionCodeEntity,
  SubscriptionCodeStatus,
  SubscriptionCodeType,
} from '../../../entity/subscription-code.entity';

export class SubscriptionCodeResponseDto {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, example: 'WELCOME2026' })
  code: string;

  @ApiProperty({
    enum: ['TRIAL', 'PAID', 'PROMOTION', 'ADMIN', 'TUMBLBUG'],
    example: 'TUMBLBUG',
  })
  type: SubscriptionCodeType;

  @ApiProperty({
    enum: ['ACTIVE', 'USED', 'EXPIRED', 'REVOKED'],
    example: 'ACTIVE',
  })
  status: SubscriptionCodeStatus;

  @ApiProperty({ type: Number, example: 100 })
  max_uses: number;

  @ApiProperty({ type: Number, example: 0 })
  used_count: number;

  @ApiProperty({ type: String, nullable: true })
  starts_at: Date | null;

  @ApiProperty({ type: String, nullable: true })
  expires_at: Date | null;

  @ApiProperty({ type: Number, example: 30 })
  benefit_days: number;

  constructor(subscriptionCode: SubscriptionCodeEntity) {
    this.id = subscriptionCode.id;
    this.code = subscriptionCode.code;
    this.type = subscriptionCode.type;
    this.status = subscriptionCode.status;
    this.max_uses = subscriptionCode.max_uses;
    this.used_count = subscriptionCode.used_count;
    this.starts_at = subscriptionCode.starts_at;
    this.expires_at = subscriptionCode.expires_at;
    this.benefit_days = subscriptionCode.benefit_days;
  }
}
