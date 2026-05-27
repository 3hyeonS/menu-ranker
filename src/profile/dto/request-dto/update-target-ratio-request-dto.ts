import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { oneDecimalNumberOptions } from '../../../utils/number.util';

@ValidatorConstraint({ name: 'sumTo100', async: false })
export class ProfileRatioSumTo100Constraint implements ValidatorConstraintInterface {
  validate(value: number[], _args: ValidationArguments) {
    if (!Array.isArray(value)) return false;
    return Math.round(value.reduce((acc, cur) => acc + cur, 0) * 10) === 1000;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'ratio sum must be 100';
  }
}

export class UpdateTargetRatioRequestDto {
  @ApiProperty({
    type: [Number],
    description: '탄단지 비율. 각 값은 소수 1자리까지 허용되며 합은 100이어야 합니다.',
    example: [45.5, 29.5, 25],
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsNumber(oneDecimalNumberOptions, { each: true })
  @Validate(ProfileRatioSumTo100Constraint)
  target_ratio: number[];
}
