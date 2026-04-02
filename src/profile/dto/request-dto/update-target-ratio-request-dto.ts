import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'sumTo100', async: false })
export class ProfileRatioSumTo100Constraint implements ValidatorConstraintInterface {
  validate(value: number[], _args: ValidationArguments) {
    if (!Array.isArray(value)) return false;
    return value.reduce((acc, cur) => acc + cur, 0) === 100;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'ratio sum must be 100';
  }
}

export class UpdateTargetRatioRequestDto {
  @ApiProperty({
    type: [Number],
    description: '탄단지 비율',
    example: [45, 30, 25],
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  @Validate(ProfileRatioSumTo100Constraint)
  target_ratio: number[];
}
