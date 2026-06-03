import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { oneDecimalNumberOptions } from '../../../../utils/number.util';

const CURRENT_YEAR = new Date().getFullYear();
const WORKER_JOB_TYPE = 0;

@ValidatorConstraint({ name: 'sumTo100', async: false })
export class SumTo100Constraint implements ValidatorConstraintInterface {
  validate(value: number[], _args: ValidationArguments) {
    if (!Array.isArray(value)) return false;
    return Math.round(value.reduce((acc, cur) => acc + cur, 0) * 10) === 1000;
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
  @IsNumber(oneDecimalNumberOptions)
  @Min(1)
  @Max(250)
  height: number;

  @ApiProperty({
    type: Number,
    description: '현재 체중',
    example: 65,
  })
  @IsNotEmpty()
  @IsNumber(oneDecimalNumberOptions)
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
  @IsNumber(oneDecimalNumberOptions)
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
    description: '탄단지 비율. 각 값은 소수 1자리까지 허용되며 합은 100이어야 합니다.',
    example: [65.5, 9.5, 25],
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(3) // 최소 크기 2
  @ArrayMaxSize(3) // 최대 크기 2
  @IsNumber(oneDecimalNumberOptions, { each: true })
  @Validate(SumTo100Constraint)
  target_ratio: number[];

  @ApiProperty({
    type: String,
    description: '구독코드',
    example: 'subCodeExample',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmedValue = value.trim();
    return trimmedValue === '' ? undefined : trimmedValue;
  })
  @IsOptional()
  @IsString()
  subCode?: string;

  @ApiProperty({
    type: [Number],
    description: '식단 관리 상태',
    example: [0, 2],
  })
  @IsNotEmpty()
  @IsArray()
  @IsInt({ each: true })
  diet_management_status: number[];

  @ApiProperty({
    type: Number,
    description: '페르소나 타입',
    example: 0,
  })
  @IsNotEmpty()
  @IsInt()
  persona_type: number;

  @ApiProperty({
    type: Number,
    description: '주간 외식 빈도',
    example: 3,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  eating_out_freq_weekly: number;

  @ApiProperty({
    type: Number,
    description: `직업 타입. ${WORKER_JOB_TYPE}이면 직장인으로 판단해 lunch_location을 받습니다.`,
    example: WORKER_JOB_TYPE,
  })
  @IsNotEmpty()
  @IsInt()
  job_type: number;

  @ApiProperty({
    type: Number,
    description:
      '점심 식사 위치. job_type이 직장인이 아닌 경우 요청값이 있어도 null로 처리됩니다.',
    example: 1,
    nullable: true,
    required: false,
  })
  @Transform(({ value, obj }) =>
    obj?.job_type === WORKER_JOB_TYPE ? value : null,
  )
  @ValidateIf((dto: RegisterUserInfoRequestDto) =>
    dto.job_type === WORKER_JOB_TYPE,
  )
  @IsNotEmpty()
  @IsInt()
  lunch_location: number | null;
}
