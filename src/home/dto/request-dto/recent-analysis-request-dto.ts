import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export const RECENT_ANALYSIS_MODES = [
  'intake',
  'weight',
  'burned',
  'deficit',
  '섭취 칼로리',
  '체중',
  '소모 칼로리',
  '칼로리 적자',
] as const;

export type RecentAnalysisMode = (typeof RECENT_ANALYSIS_MODES)[number];

export class RecentAnalysisRequestDto {
  @ApiProperty({
    type: String,
    description:
      '조회 기준일(YYYY-MM-DD). 기준일을 포함한 최근 30일을 조회합니다.',
    example: '2026-09-29',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiProperty({
    enum: RECENT_ANALYSIS_MODES,
    description:
      '분석 항목. intake(섭취 칼로리), weight(체중), burned(소모 칼로리), deficit(칼로리 적자)',
    example: 'intake',
  })
  @IsString()
  @IsIn(RECENT_ANALYSIS_MODES)
  mode: RecentAnalysisMode;
}
