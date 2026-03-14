import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const CURRENT_YEAR = new Date().getFullYear();

@ValidatorConstraint({ name: 'sumTo100', async: false })
export class SumTo100Constraint implements ValidatorConstraintInterface {
  validate(value: number[], _args: ValidationArguments) {
    if (!Array.isArray(value)) return false;
    return value.reduce((acc, cur) => acc + cur, 0) === 100;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'ratio sum must be 100';
  }
}

export class RegisterUserInfoRequestDto {
  @ApiProperty({
    enum: [0, 1],
    description: '성별 (0: 남성, 1: 여성)',
    example: 0,
  })
  @IsNotEmpty()
  @IsIn([0, 1])
  gender: number;

  @ApiProperty({
    type: Number,
    description: '출생년도',
    example: 1999,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(CURRENT_YEAR - 100)
  @Max(CURRENT_YEAR - 10)
  birthYear: number;

  @ApiProperty({
    type: Number,
    description: '신장',
    example: 170,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(250)
  height: number;

  @ApiProperty({
    type: Number,
    description: '체중',
    example: 65,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(200)
  weight: number;

  @ApiProperty({
    enum: [0, 1, 2, 3],
    description: '활동량(리스트 순서대로 0, 1, 2, 3)',
    example: 0,
  })
  @IsNotEmpty()
  @IsIn([0, 1, 2, 3])
  activity: number;

  @ApiProperty({
    enum: [0, 1, 2],
    description: '목표(리스트 순서대로 0, 1, 2)',
    example: 2,
  })
  @IsNotEmpty()
  @IsIn([0, 1, 2])
  goal: number;

  @ApiProperty({
    type: Number,
    description: '목표 체중',
    example: 65,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(200)
  target_weight: number;

  @ApiProperty({
    type: Number,
    description: '목표 칼로리',
    example: 65,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(99999)
  target_calories: number;

  @ApiProperty({
    type: [Number],
    description: '탄단지 비율',
    example: [65, 10, 25],
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(3) // 최소 크기 2
  @ArrayMaxSize(3) // 최대 크기 2
  @IsInt({ each: true })
  @Validate(SumTo100Constraint)
  target_ratio: number[];

  @ApiProperty({
    type: String,
    description: '구독코드',
    example: 'subCodeExample',
  })
  @IsOptional()
  @IsString()
  subCode?: string;
}
