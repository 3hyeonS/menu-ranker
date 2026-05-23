import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SubscriptionCodeType } from '../../../entity/subscription-code.entity';

export class CreateSubscriptionCodeRequestDto {
  @ApiProperty({
    type: String,
    description: '발급할 구독 코드',
    example: 'WELCOME2026',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  code: string;

  @ApiProperty({
    enum: ['TRIAL', 'PAID', 'PROMOTION', 'ADMIN'],
    description: '구독 코드 유형',
    example: 'PROMOTION',
    required: false,
  })
  @IsOptional()
  @IsIn(['TRIAL', 'PAID', 'PROMOTION', 'ADMIN'])
  type?: SubscriptionCodeType;

  @ApiProperty({
    type: Number,
    description: '최대 사용 가능 횟수',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  max_uses?: number;

  @ApiProperty({
    type: Number,
    description: '코드 사용 시 부여할 구독 일수',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  benefit_days?: number;

  @ApiProperty({
    type: String,
    description: '코드 사용 시작 가능 시각',
    example: '2026-05-23T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @ApiProperty({
    type: String,
    description: '코드 자체 만료 시각',
    example: '2026-12-31T14:59:59.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
