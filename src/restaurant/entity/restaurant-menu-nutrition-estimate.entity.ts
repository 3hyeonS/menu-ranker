import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 추정값 출처. mfds: 식약처 음식명 정확 일치(LLM 미사용), llm: Gemini 추정. */
export type MenuNutritionEstimateSource = 'mfds' | 'llm';
/** llm 추정이 채택된 경로. rag: 공식 브랜드 유사 메뉴 근거, llm_only: 근거 없이 재추정. */
export type MenuNutritionEstimatePath = 'rag' | 'llm_only';

/**
 * 카카오 지점 메뉴명을 정규화한 이름 단위의 영양 추정값(#41). 같은 이름의 지점 메뉴는 이 값을 공유한다.
 * 지점 메뉴(`restaurant_branch_menu.name`)와는 `normalizeBranchMenuName` 결과로 조회 시점에 잇는다(FK 없음).
 * `restaurant:menu-nutrition:import`가 normalized_name 기준으로 upsert한다.
 * 영양값은 weight(unit 0=g, 1=ml) 전체 기준이다. confidence 0.6 미만은 저장하되 앱에는 내보내지 않는다.
 */
@Entity('restaurant_menu_nutrition_estimate')
export class RestaurantMenuNutritionEstimateEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index('UQ_restaurant_menu_nutrition_estimate_name', { unique: true })
  @Column({ type: 'varchar', length: 255, name: 'normalized_name' })
  normalizedName: string;

  // 추정에 쓴 대표 원문 메뉴명(그 이름으로 가장 많이 쓰인 표기).
  @Column({ type: 'varchar', length: 255, name: 'sample_name' })
  sampleName: string;

  @Column({ type: 'varchar', length: 10 })
  source: MenuNutritionEstimateSource;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  calories: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  carbs: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  protein: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  fat: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  sugars: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 3,
    name: 'sat_fat',
    nullable: true,
  })
  satFat: number | null;

  // 0은 g, 1은 ml(restaurant_menu.unit과 같음).
  @Column({ type: 'tinyint', default: 0 })
  unit: number;

  // 영양값의 기준 중량. llm은 1인분 추정 총중량이다.
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  weight: number | null;

  @Column({ type: 'varchar', length: 50, name: 'unit_quantity' })
  unitQuantity: string;

  // 0~1. mfds는 1이다.
  @Column({ type: 'decimal', precision: 4, scale: 3, nullable: true })
  confidence: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'estimate_path',
    nullable: true,
  })
  estimatePath: MenuNutritionEstimatePath | null;

  // RAG 1차 추정의 confidence(재추정 여부 판단에 쓴 값).
  @Column({
    type: 'decimal',
    precision: 4,
    scale: 3,
    name: 'rag_confidence',
    nullable: true,
  })
  ragConfidence: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'prompt_version',
    nullable: true,
  })
  promptVersion: string | null;

  // 근거 메뉴. llm: RAG 근거 [{ name, brand, score }], mfds: [{ menu_id, name }].
  @Column({ type: 'json', name: 'reference_menus', nullable: true })
  referenceMenus: unknown[] | null;

  // 이 메뉴에 나눠 매긴 토큰 수(묶음 호출 토큰 ÷ 묶음 메뉴 수, 재시도·재추정 포함).
  @Column({ type: 'int', name: 'input_tokens', nullable: true })
  inputTokens: number | null;

  @Column({ type: 'int', name: 'output_tokens', nullable: true })
  outputTokens: number | null;

  // 추정 결과 파일에 기록된 생성 시각.
  @Column({ type: 'datetime', precision: 6, name: 'estimated_at' })
  estimatedAt: Date;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
