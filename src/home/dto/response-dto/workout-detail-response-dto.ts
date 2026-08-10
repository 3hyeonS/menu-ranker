import { ApiProperty } from '@nestjs/swagger';

export class WorkoutDetailResponseDto {
  @ApiProperty({ type: Number, description: '운동 id', example: 1 })
  workout_id: number;

  @ApiProperty({
    type: String,
    description: '운동명',
    example: '벤치프레스',
  })
  workout_name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '운동 gif',
    example: 'https://example.com/workout.gif',
  })
  workout_gif: string | null;

  @ApiProperty({
    type: String,
    enum: ['cardio', 'weight'],
    description: '운동 유형',
    example: 'weight',
  })
  workout_type: 'cardio' | 'weight';

  @ApiProperty({
    type: Number,
    nullable: true,
    description: '운동 MET 값',
    example: 5,
  })
  met: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '운동 부위 대분류',
    enum: ['유산소', '가슴', '등', '하체', '어깨', '팔', '코어'],
    example: '하체',
  })
  body_part_major: string | null;

  @ApiProperty({
    type: [String],
    nullable: true,
    description: '운동 부위 소분류',
    example: ['허벅지'],
  })
  body_part_minor: string[] | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '운동 기구 대분류',
    enum: [
      '바벨',
      '덤벨',
      '케틀벨',
      '밴드',
      '머신',
      '스미스 머신',
      '맨몸',
      '폼롤러',
      '케이블 머신',
      '기타',
    ],
    example: '덤벨',
  })
  equipment_category: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '머신 또는 기타로 분류된 기구의 상세명',
    example: '메디신볼',
  })
  equipment_detail: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '원본 운동 데이터의 기구 상세값',
    example: 'lever sled 45 degree leg press',
  })
  equipment_original_detail: string | null;
}
