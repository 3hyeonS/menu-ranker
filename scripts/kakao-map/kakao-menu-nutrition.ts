// 카카오 지점 메뉴 영양 추정(#41)의 순수 로직: 대상 메뉴명 집계, 식약처 정확 일치, RAG 근거 검색,
// 프롬프트, 응답 검증, 토큰·비용 추정, 평가 지표. DB·파일·네트워크 접근은 없다(CLI가 맡는다).
import { normalizeBranchMenuName } from '../../src/utils/branch-menu-name.util';
import type { MenuNutritionEstimatePath } from '../../src/restaurant/entity/restaurant-menu-nutrition-estimate.entity';

export const PROMPT_VERSION = 'kakao-menu-nutrition-v1';
export const DEFAULT_ESTIMATE_MODEL = 'gemini-2.5-flash-lite';
/** 프로토콜: 공식 영양정보가 있는 유사 메뉴 상위 8개를 근거로 쓴다. */
export const RAG_REFERENCE_LIMIT = 8;
/** 프로토콜: 미관측 브랜드는 RAG confidence가 이 값 미만이면 근거 없이 다시 추정한다. */
export const DEFAULT_FALLBACK_THRESHOLD = 0.7;
/** 식당 카테고리가 근거 메뉴의 브랜드 카테고리를 포함할 때 더하는 점수(프로토콜의 식당 카테고리 +0.08). */
const CATEGORY_BONUS = 0.08;

// 벤치마크(2026-10-18) 프롬프트로 보정한 글자당 입력 토큰(132,871토큰 / 344,788자 ≈ 0.385).
export const INPUT_TOKENS_PER_CHAR = 0.39;
// 벤치마크 출력은 필드 6개에 메뉴당 68.7토큰이었다. 이 프롬프트는 필드 9개라 약 100토큰으로 잡는다.
export const OUTPUT_TOKENS_PER_MENU = 100;
// 벤치마크에서 미관측 브랜드 RAG confidence가 0.7 미만이던 비율(재추정 상한 추정용).
export const OBSERVED_FALLBACK_RATIO = 0.56;
// 10개 묶음 한 번의 평균 응답 시간(벤치마크 순차 측정).
export const MEAN_BATCH_LATENCY_SECONDS = 2.13;

export type NutrientKey =
  | 'calories'
  | 'carbs'
  | 'protein'
  | 'fat'
  | 'sugars'
  | 'satFat';
export const NUTRIENT_KEYS: readonly NutrientKey[] = [
  'calories',
  'carbs',
  'protein',
  'fat',
  'sugars',
  'satFat',
];
export type NutritionValues = Record<NutrientKey, number | null>;

// ---------------------------------------------------------------------------
// 대상 메뉴명 집계

export interface BranchMenuRow {
  placeId: string;
  name: string;
}

export interface MenuNameTarget {
  /** normalizeBranchMenuName 결과. 추정 테이블의 normalized_name. */
  key: string;
  /** 이 이름으로 가장 많이 쓰인 원문 표기(동률이면 사전순). 프롬프트에 넣는다. */
  sampleName: string;
  storeCount: number;
  rowCount: number;
  /** 이 이름을 가진 매장에서 가장 많은 카카오 카테고리('음식점 > ' 제외). */
  restaurantCategory: string | null;
  /** 원문에 크기·수량 표기((대)·2인분·L 등)가 있던 행 수. 크기별 추정 필요성 측정용(#41 결정 6). */
  sizeMarkedRowCount: number;
}

const SIZE_MARK_PATTERN =
  /[([{]\s*(?:[소중대특]|[SMLR]|\d+\s*(?:인분|인|개|조각|피스|p|pcs|마리|판|잔|병|g|kg|ml|l))\s*[)\]}]|\d+\s*인분|(?<![\p{L}\p{N}_])(?:[소중대특]|[SMLR])(?![\p{L}\p{N}_])/iu;

export function hasSizeMark(name: string): boolean {
  return SIZE_MARK_PATTERN.test(name);
}

/** 카카오 카테고리에서 공통 접두어 '음식점 > '를 뗀다. */
export function shortKakaoCategory(category: string | null): string | null {
  const value = (category ?? '').replace(/^음식점\s*>\s*/, '').trim();
  return value || null;
}

function topEntry(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < (best ?? ''))) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * 지점 메뉴 행을 정규화 이름으로 묶어 매장 수 내림차순(동률이면 행 수, 이름)으로 정렬한다.
 * 정규화 결과가 빈 이름(기호만 있는 메뉴 등)은 뺀다.
 */
export function collectMenuNameTargets(
  rows: Iterable<BranchMenuRow>,
  categoryByPlaceId: ReadonlyMap<string, string | null>,
): { targets: MenuNameTarget[]; rowCount: number; emptyNameRowCount: number } {
  const groups = new Map<
    string,
    {
      places: Set<string>;
      rowCount: number;
      sizeMarkedRowCount: number;
      names: Map<string, number>;
      categories: Map<string, number>;
    }
  >();
  let rowCount = 0;
  let emptyNameRowCount = 0;

  for (const row of rows) {
    rowCount += 1;
    const key = normalizeBranchMenuName(row.name);
    if (!key) {
      emptyNameRowCount += 1;
      continue;
    }
    let group = groups.get(key);
    if (!group) {
      group = {
        places: new Set(),
        rowCount: 0,
        sizeMarkedRowCount: 0,
        names: new Map(),
        categories: new Map(),
      };
      groups.set(key, group);
    }
    group.rowCount += 1;
    if (hasSizeMark(row.name)) group.sizeMarkedRowCount += 1;
    const name = row.name.trim();
    group.names.set(name, (group.names.get(name) ?? 0) + 1);
    if (!group.places.has(row.placeId)) {
      group.places.add(row.placeId);
      const category = shortKakaoCategory(
        categoryByPlaceId.get(row.placeId) ?? null,
      );
      if (category) {
        group.categories.set(
          category,
          (group.categories.get(category) ?? 0) + 1,
        );
      }
    }
  }

  const targets = [...groups.entries()].map(
    ([key, group]): MenuNameTarget => ({
      key,
      sampleName: topEntry(group.names) ?? key,
      storeCount: group.places.size,
      rowCount: group.rowCount,
      restaurantCategory: topEntry(group.categories),
      sizeMarkedRowCount: group.sizeMarkedRowCount,
    }),
  );
  targets.sort(
    (left, right) =>
      right.storeCount - left.storeCount ||
      right.rowCount - left.rowCount ||
      (left.key < right.key ? -1 : left.key > right.key ? 1 : 0),
  );
  return { targets, rowCount, emptyNameRowCount };
}

// ---------------------------------------------------------------------------
// 공식 브랜드 메뉴(RAG 근거)

export interface ReferenceMenu {
  id: number;
  name: string;
  brand: string;
  restaurantCategory: string | null;
  menuCategory: string | null;
  unit: number;
  /** 영양값의 기준 중량(제품 총중량이 아님, 수집 규칙 5절) */
  weight: number | null;
  /** 단위량(1개, 1조각, 100g 등). 영양값이 무엇 기준인지 알려 준다. */
  unitQuantity: string | null;
  nutrition: NutritionValues;
}

const REFERENCE_HEADERS = {
  name: '메뉴',
  brand: '브랜드',
  restaurantCategory: '브랜드 카테고리',
  menuCategory: '메뉴 카테고리',
  unit: '중량 단위',
  weight: '중량',
  unitQuantity: '단위량',
  calories: '칼로리',
  carbs: '탄수화물',
  sugars: '당류',
  protein: '단백질',
  fat: '지방',
  satFat: '포화지방',
} as const;

export function nullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim().replace(/,/g, '');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 수집 규칙 문서의 23열 메뉴 CSV(브랜드 공식 영양정보). 칼로리가 없는 행은 근거로 쓰지 않는다. */
export function parseReferenceMenus(rows: string[][]): ReferenceMenu[] {
  const header = (rows[0] ?? []).map((value) => value.trim());
  const index = Object.fromEntries(
    Object.entries(REFERENCE_HEADERS).map(([key, label]) => [
      key,
      header.indexOf(label),
    ]),
  ) as Record<keyof typeof REFERENCE_HEADERS, number>;
  const missing = Object.entries(index)
    .filter(([, position]) => position < 0)
    .map(([key]) => REFERENCE_HEADERS[key as keyof typeof REFERENCE_HEADERS]);
  if (missing.length > 0) {
    throw new Error(`근거 메뉴 CSV에 열이 없습니다: ${missing.join(', ')}`);
  }

  const menus: ReferenceMenu[] = [];
  rows.slice(1).forEach((row, rowIndex) => {
    const cell = (key: keyof typeof REFERENCE_HEADERS) =>
      (row[index[key]] ?? '').trim();
    const calories = nullableNumber(cell('calories'));
    const name = cell('name');
    if (!name || calories == null) return;
    menus.push({
      id: rowIndex + 1,
      name,
      brand: cell('brand'),
      restaurantCategory: cell('restaurantCategory') || null,
      menuCategory: cell('menuCategory') || null,
      unit: nullableNumber(cell('unit')) === 1 ? 1 : 0,
      weight: nullableNumber(cell('weight')),
      unitQuantity: cell('unitQuantity') || null,
      nutrition: {
        calories,
        carbs: nullableNumber(cell('carbs')),
        protein: nullableNumber(cell('protein')),
        fat: nullableNumber(cell('fat')),
        sugars: nullableNumber(cell('sugars')),
        satFat: nullableNumber(cell('satFat')),
      },
    });
  });
  return menus;
}

function bigrams(key: string): string[] {
  if (key.length === 1) return [key];
  const values = new Set<string>();
  for (let index = 0; index < key.length - 1; index += 1) {
    values.add(key.slice(index, index + 2));
  }
  return [...values];
}

export interface ReferenceMatch {
  menu: ReferenceMenu;
  score: number;
}

/**
 * 메뉴명 문자 bigram Jaccard + 식당 카테고리 보너스로 공식 메뉴를 고른다.
 * 프로토콜의 Gemini 임베딩(55%)은 쓰지 않는다. 미관측 브랜드 벤치마크에서 임베딩이 문자 유사도보다
 * 나빴고(embedding summary), 쿼리마다 임베딩 API를 더 불러야 하기 때문이다.
 */
export class ReferenceIndex {
  private readonly entries: Array<{ menu: ReferenceMenu; grams: number }>;
  private readonly postings = new Map<string, number[]>();

  constructor(readonly menus: readonly ReferenceMenu[]) {
    this.entries = menus.map((menu, position) => {
      const grams = bigrams(normalizeBranchMenuName(menu.name));
      for (const gram of grams) {
        const list = this.postings.get(gram) ?? [];
        list.push(position);
        this.postings.set(gram, list);
      }
      return { menu, grams: grams.length };
    });
  }

  search(
    name: string,
    restaurantCategory: string | null,
    options: { limit?: number; excludeBrand?: string } = {},
  ): ReferenceMatch[] {
    const limit = options.limit ?? RAG_REFERENCE_LIMIT;
    const grams = bigrams(normalizeBranchMenuName(name));
    if (grams.length === 0) return [];
    const overlap = new Map<number, number>();
    for (const gram of grams) {
      for (const position of this.postings.get(gram) ?? []) {
        overlap.set(position, (overlap.get(position) ?? 0) + 1);
      }
    }
    const category = (restaurantCategory ?? '').replace(/\s+/g, '');
    const matches: ReferenceMatch[] = [];
    for (const [position, shared] of overlap) {
      const entry = this.entries[position];
      if (options.excludeBrand && entry.menu.brand === options.excludeBrand) {
        continue;
      }
      const jaccard = shared / (grams.length + entry.grams - shared);
      const brandCategory = (entry.menu.restaurantCategory ?? '').replace(
        /\s+/g,
        '',
      );
      const bonus =
        brandCategory && category.includes(brandCategory) ? CATEGORY_BONUS : 0;
      matches.push({ menu: entry.menu, score: jaccard + bonus });
    }
    matches.sort(
      (left, right) => right.score - left.score || left.menu.id - right.menu.id,
    );
    return matches.slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// 식약처 음식명 정확 일치

export interface MfdsMenu {
  id: number;
  /** 출처 접두어를 포함한 DB 이름 그대로. */
  name: string;
  unit: number;
  weight: number | null;
  unitQuantity: string;
  nutrition: NutritionValues;
}

/** DB SELECT 행(또는 같은 키의 JSON 파일)을 MfdsMenu로 바꾼다. */
export function toMfdsMenu(row: Record<string, unknown>): MfdsMenu | null {
  const id = nullableNumber(row.id);
  const calories = nullableNumber(row.calories);
  if (id == null || calories == null || typeof row.name !== 'string') {
    return null;
  }
  return {
    id,
    name: row.name,
    unit: nullableNumber(row.unit) === 1 ? 1 : 0,
    weight: nullableNumber(row.weight),
    unitQuantity: String(row.unit_quantity ?? '').trim() || '인분',
    nutrition: {
      calories,
      carbs: nullableNumber(row.carbs),
      protein: nullableNumber(row.protein),
      fat: nullableNumber(row.fat),
      sugars: nullableNumber(row.sugars),
      satFat: nullableNumber(row.sat_fat),
    },
  };
}

/**
 * 정규화 이름 → 식약처 메뉴. 같은 이름이 여럿이면 괄호 등을 지우기 전에도 이름이 같던 것,
 * 그다음 id가 작은 것을 쓴다(예: `김치찌개`와 `김치찌개(돼지고기)`가 겹치면 `김치찌개`).
 */
export function buildMfdsIndex(
  menus: readonly MfdsMenu[],
): Map<string, MfdsMenu> {
  const index = new Map<string, MfdsMenu>();
  const isPlain = (menu: MfdsMenu, key: string) =>
    menu.name
      .replace(/^\(식약처_(?:음식|가공)\)\s*/, '')
      .replace(/\s+/g, '')
      .toLowerCase() === key;
  for (const menu of [...menus].sort((left, right) => left.id - right.id)) {
    const key = normalizeBranchMenuName(menu.name);
    if (!key) continue;
    const current = index.get(key);
    if (!current || (!isPlain(current, key) && isPlain(menu, key))) {
      index.set(key, menu);
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// 추정 결과 레코드(JSONL 한 줄)

export interface EstimateRecord {
  normalizedName: string;
  sampleName: string;
  status: 'ok' | 'failed';
  source: 'mfds' | 'llm';
  nutrition: NutritionValues | null;
  unit: number;
  weight: number | null;
  unitQuantity: string;
  confidence: number | null;
  ragConfidence: number | null;
  path: MenuNutritionEstimatePath | null;
  model: string | null;
  promptVersion: string | null;
  references: unknown[];
  inputTokens: number;
  outputTokens: number;
  error: string | null;
  estimatedAt: string;
  storeCount?: number;
  rowCount?: number;
}

export function mfdsRecord(
  target: Pick<
    MenuNameTarget,
    'key' | 'sampleName' | 'storeCount' | 'rowCount'
  >,
  menu: MfdsMenu,
  now: Date,
): EstimateRecord {
  return {
    normalizedName: target.key,
    sampleName: target.sampleName,
    status: 'ok',
    source: 'mfds',
    nutrition: { ...menu.nutrition },
    unit: menu.unit,
    weight: menu.weight,
    unitQuantity: menu.unitQuantity,
    confidence: 1,
    ragConfidence: null,
    path: null,
    model: null,
    promptVersion: null,
    references: [{ menu_id: menu.id, name: menu.name }],
    inputTokens: 0,
    outputTokens: 0,
    error: null,
    estimatedAt: now.toISOString(),
    storeCount: target.storeCount,
    rowCount: target.rowCount,
  };
}

/** JSONL 줄 하나를 검증한다. 형식이 틀리면 null(중단으로 덜 쓰인 줄 등). */
export function parseEstimateRecord(value: unknown): EstimateRecord | null {
  if (value == null || typeof value !== 'object') return null;
  const record = value as EstimateRecord;
  if (
    typeof record.normalizedName !== 'string' ||
    !record.normalizedName ||
    typeof record.sampleName !== 'string' ||
    (record.status !== 'ok' && record.status !== 'failed') ||
    (record.source !== 'mfds' && record.source !== 'llm') ||
    typeof record.estimatedAt !== 'string' ||
    Number.isNaN(Date.parse(record.estimatedAt))
  ) {
    return null;
  }
  if (record.status === 'ok' && record.nutrition?.calories == null) {
    return null;
  }
  return record;
}

/** 같은 이름은 나중 성공 레코드가 이긴다. 성공 레코드가 하나도 없는 이름 수도 센다. */
export function latestOkRecords(records: Iterable<EstimateRecord>): {
  records: EstimateRecord[];
  failedOnlyCount: number;
} {
  const okByName = new Map<string, EstimateRecord>();
  const failedNames = new Set<string>();
  for (const record of records) {
    if (record.status === 'ok') {
      okByName.set(record.normalizedName, record);
    } else {
      failedNames.add(record.normalizedName);
    }
  }
  return {
    records: [...okByName.values()],
    failedOnlyCount: [...failedNames].filter((name) => !okByName.has(name))
      .length,
  };
}

// ---------------------------------------------------------------------------
// 프롬프트와 응답 검증

export type EstimateMethod = MenuNutritionEstimatePath;

export interface PromptItem {
  /** 묶음 안의 순번("1".."10"). 내부 ID를 외부로 보내지 않는다. */
  id: string;
  name: string;
  restaurantCategory: string | null;
  references?: readonly ReferenceMatch[];
}

function withoutNulls(
  values: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value != null && value !== ''),
  );
}

/**
 * 메뉴 자체의 속성(메뉴명·식당 카테고리)과 공식 근거 메뉴만 보낸다.
 * 사용자 정보·장소 id·주소는 넣지 않는다(docs/restaurant-nutrition-prompt-data-boundary.md).
 */
export function buildEstimatePrompt(
  items: readonly PromptItem[],
  method: EstimateMethod,
): string {
  const payload = items.map((item) =>
    withoutNulls({
      id: item.id,
      menu: withoutNulls({
        name: item.name,
        restaurantCategory: item.restaurantCategory,
      }),
      referenceMenus:
        method === 'rag'
          ? (item.references ?? []).map(({ menu }) =>
              withoutNulls({
                name: menu.name,
                brand: menu.brand,
                restaurantCategory: menu.restaurantCategory,
                menuCategory: menu.menuCategory,
                [menu.unit === 1 ? 'weightMl' : 'weightG']: menu.weight,
                unitQuantity: menu.unitQuantity,
                nutrition: withoutNulls({ ...menu.nutrition }),
              }),
            )
          : undefined,
    }),
  );
  const ragRule =
    method === 'rag'
      ? '- referenceMenus는 다른 식당의 공식 영양정보 유사 메뉴 근거다. nutrition은 메뉴 전체가 아니라 weightG(또는 weightMl)·unitQuantity 기준 값이다. 목표 메뉴와 같다고 가정하지 말고, 구성이 비슷할 때만 참고해.\n'
      : '';
  return `한국 일반 식당 메뉴의 1인분(메뉴 1개 주문) 기준 영양성분을 추정해.
규칙:
- 입력은 메뉴명과 카카오맵 식당 카테고리뿐이다. 중량·구성은 일반적인 한국 식당 기준으로 추정해.
- 크기·수량 표기((대), (중), 2인분, L 등)가 있어도 기본 크기 1인분 기준으로 계산해. 세트·정식은 구성 전체 기준이야.
${ragRule}- calories(kcal), carbs·protein·fat·sugars·satFat(g), weightG(1인분 총중량 g)를 모두 0 이상의 숫자로 반환해.
- confidence는 0~1 숫자야. 메뉴 구성이나 양이 불명확하거나 음식이 아니면(포장비, 추가 옵션 등) 낮게 줘.
- 설명 없이 JSON 배열만 반환해. 입력 순서와 id를 보존해.
형식: [{"id":"1","calories":0,"carbs":0,"protein":0,"fat":0,"sugars":0,"satFat":0,"weightG":0,"confidence":0}]
입력:
${JSON.stringify(payload)}`;
}

export interface EstimateValues {
  nutrition: Record<NutrientKey, number>;
  weight: number | null;
  confidence: number;
}

// 1인분 값으로 믿기 어려운 상한. 넘으면 형식 오류처럼 다시 묻는다.
const MAX_CALORIES = 6000;
const MAX_GRAMS = 2000;
const MAX_WEIGHT_G = 5000;

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function boundedNumber(value: unknown, max: number): number | null {
  const parsed = nullableNumber(value);
  return parsed != null && parsed >= 0 && parsed <= max ? parsed : null;
}

/** 응답 배열에서 id별 유효한 추정값만 고른다. 빠졌거나 숫자가 아닌 항목은 결과에 없다. */
export function parseEstimateResponse(
  value: unknown,
  ids: readonly string[],
): Map<string, EstimateValues> {
  const result = new Map<string, EstimateValues>();
  if (!Array.isArray(value)) return result;
  const wanted = new Set(ids);
  for (const item of value) {
    if (item == null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '');
    if (!wanted.has(id) || result.has(id)) continue;
    const calories = boundedNumber(row.calories, MAX_CALORIES);
    const carbs = boundedNumber(row.carbs, MAX_GRAMS);
    const protein = boundedNumber(row.protein, MAX_GRAMS);
    const fat = boundedNumber(row.fat, MAX_GRAMS);
    const sugars = boundedNumber(row.sugars, MAX_GRAMS);
    const satFat = boundedNumber(row.satFat, MAX_GRAMS);
    const confidence = boundedNumber(row.confidence, 1);
    if (
      [calories, carbs, protein, fat, sugars, satFat, confidence].some(
        (field) => field == null,
      )
    ) {
      continue;
    }
    const weight = boundedNumber(row.weightG, MAX_WEIGHT_G);
    result.set(id, {
      nutrition: {
        calories: round(calories, 1),
        carbs: round(carbs, 1),
        protein: round(protein, 1),
        fat: round(fat, 1),
        sugars: round(sugars, 1),
        satFat: round(satFat, 1),
      },
      weight: weight && weight > 0 ? round(weight, 1) : null,
      confidence: round(confidence, 3),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// 토큰·비용 추정(--dry-run)

export function estimateInputTokens(prompt: string): number {
  return Math.ceil(prompt.length * INPUT_TOKENS_PER_CHAR);
}

export interface TokenPrices {
  /** 입력 1M 토큰당 USD */
  input: number;
  /** 출력 1M 토큰당 USD */
  output: number;
}

export function costUsd(
  inputTokens: number,
  outputTokens: number,
  prices: TokenPrices,
): number {
  return (
    (inputTokens * prices.input + outputTokens * prices.output) / 1_000_000
  );
}

export interface RunEstimateOptions {
  batchSize: number;
  concurrency: number;
  rpm: number;
  fallbackThreshold: number;
  prices: TokenPrices;
  referenceLimit?: number;
}

export interface RunEstimate {
  llmMenuCount: number;
  /** 근거 메뉴가 없어 RAG 없이 바로 순수 LLM으로 보내는 메뉴 */
  referencelessMenuCount: number;
  ragRequestCount: number;
  /** 근거 없는 메뉴 + RAG confidence 미만 재추정(벤치마크 비율 56%로 가정) */
  llmOnlyMenuCount: number;
  llmOnlyRequestCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** 재추정이 하나도 없을 때(근거 없는 메뉴만 순수 LLM)의 하한 */
  minimumCostUsd: number;
  /** 동시성만으로 본 이론 시간(분). RPM·TPM 제한·재시도는 빼고 계산한다. */
  estimatedMinutes: number;
  /** --rpm 제한만으로 본 최소 시간(분) */
  rpmLimitedMinutes: number;
}

/**
 * --dry-run 비용 추정. 실제 프롬프트를 만들어 글자 수로 입력 토큰을 셈하고, 출력은 메뉴당 고정값으로 잡는다.
 * 재추정 수는 미리 알 수 없어 벤치마크 비율을 쓴다.
 */
export function estimateRun(
  targets: ReadonlyArray<
    Pick<MenuNameTarget, 'sampleName' | 'restaurantCategory'>
  >,
  index: ReferenceIndex,
  options: RunEstimateOptions,
): RunEstimate {
  const fallbackRatio =
    options.fallbackThreshold > 0 ? OBSERVED_FALLBACK_RATIO : 0;
  let ragInput = 0;
  let ragMenus = 0;
  let ragRequests = 0;
  let llmOnlyInputPerMenuSum = 0;
  let referenceless = 0;
  let referencelessInput = 0;
  // 묶음마다 순수 LLM 요청이 한 번 생기는지: 근거 없는 메뉴가 있거나, 재추정을 켰을 때(56%면 거의 모든 묶음).
  let llmOnlyRequests = 0;
  for (let start = 0; start < targets.length; start += options.batchSize) {
    const items: PromptItem[] = targets
      .slice(start, start + options.batchSize)
      .map((target, position) => ({
        id: String(position + 1),
        name: target.sampleName,
        restaurantCategory: target.restaurantCategory,
        references: index.search(target.sampleName, target.restaurantCategory, {
          limit: options.referenceLimit,
        }),
      }));
    const withReferences = items.filter((item) => item.references.length > 0);
    const llmOnlyPerMenu =
      estimateInputTokens(buildEstimatePrompt(items, 'llm_only')) /
      items.length;
    if (withReferences.length > 0) {
      ragInput += estimateInputTokens(
        buildEstimatePrompt(withReferences, 'rag'),
      );
      ragMenus += withReferences.length;
      ragRequests += 1;
    }
    llmOnlyInputPerMenuSum += llmOnlyPerMenu * withReferences.length;
    if (
      withReferences.length < items.length ||
      (fallbackRatio > 0 && withReferences.length > 0)
    ) {
      llmOnlyRequests += 1;
    }
    referenceless += items.length - withReferences.length;
    referencelessInput +=
      llmOnlyPerMenu * (items.length - withReferences.length);
  }
  const fallbackMenus = ragMenus * fallbackRatio;
  const llmOnlyMenus = referenceless + fallbackMenus;
  const llmOnlyInput =
    referencelessInput + llmOnlyInputPerMenuSum * fallbackRatio;
  const inputTokens = Math.round(ragInput + llmOnlyInput);
  const outputTokens = Math.round(
    (ragMenus + llmOnlyMenus) * OUTPUT_TOKENS_PER_MENU,
  );
  const requests = ragRequests + llmOnlyRequests;
  return {
    llmMenuCount: targets.length,
    referencelessMenuCount: referenceless,
    ragRequestCount: ragRequests,
    llmOnlyMenuCount: Math.round(llmOnlyMenus),
    llmOnlyRequestCount: llmOnlyRequests,
    inputTokens,
    outputTokens,
    costUsd: round(costUsd(inputTokens, outputTokens, options.prices), 2),
    minimumCostUsd: round(
      costUsd(
        ragInput + referencelessInput,
        (ragMenus + referenceless) * OUTPUT_TOKENS_PER_MENU,
        options.prices,
      ),
      2,
    ),
    estimatedMinutes: round(
      (Math.ceil(requests / options.concurrency) * MEAN_BATCH_LATENCY_SECONDS) /
        60,
      1,
    ),
    rpmLimitedMinutes: round(requests / options.rpm, 1),
  };
}

// ---------------------------------------------------------------------------
// 평가 지표

export interface BrandEvaluationTarget extends MenuNameTarget {
  brand: string;
  truth: NutritionValues;
}

/**
 * 브랜드 연결 지점의 카카오 메뉴 중 같은 브랜드 공식 메뉴와 정규화 이름이 같은 것을 정답 표본으로 만든다.
 * 추정할 때 그 브랜드의 공식 메뉴는 근거에서 빼서(excludeBrand) 개인 식당(미관측 브랜드)처럼 평가한다.
 */
export function buildBrandEvaluationTargets(
  brandRows: ReadonlyArray<BranchMenuRow & { brand: string }>,
  references: readonly ReferenceMenu[],
  categoryByPlaceId: ReadonlyMap<string, string | null>,
): BrandEvaluationTarget[] {
  const officialByBrandKey = new Map<string, ReferenceMenu>();
  for (const menu of references) {
    const key = `${menu.brand}\u0000${normalizeBranchMenuName(menu.name)}`;
    if (!officialByBrandKey.has(key)) officialByBrandKey.set(key, menu);
  }
  const rowsByBrand = new Map<string, BranchMenuRow[]>();
  for (const row of brandRows) {
    if (!row.brand) continue;
    const rows = rowsByBrand.get(row.brand) ?? [];
    rows.push(row);
    rowsByBrand.set(row.brand, rows);
  }
  const perBrand: BrandEvaluationTarget[][] = [];
  for (const brand of [...rowsByBrand.keys()].sort()) {
    const targets: BrandEvaluationTarget[] = [];
    // collectMenuNameTargets가 매장 수 순으로 정렬해 돌려준다.
    for (const target of collectMenuNameTargets(
      rowsByBrand.get(brand),
      categoryByPlaceId,
    ).targets) {
      const official = officialByBrandKey.get(`${brand}\u0000${target.key}`);
      if (official) {
        targets.push({ ...target, brand, truth: { ...official.nutrition } });
      }
    }
    if (targets.length > 0) perBrand.push(targets);
  }
  // 지점이 많은 몇 브랜드에 표본이 몰리지 않게 브랜드를 번갈아 가며 매장 수가 많은 메뉴부터 넣는다.
  const interleaved: BrandEvaluationTarget[] = [];
  for (
    let rank = 0;
    perBrand.some((targets) => rank < targets.length);
    rank += 1
  ) {
    for (const targets of perBrand) {
      if (rank < targets.length) interleaved.push(targets[rank]);
    }
  }
  return interleaved;
}

export interface EvaluationRow {
  truth: NutritionValues;
  record: EstimateRecord;
}

export interface NutrientMetric {
  evaluated: number;
  mae: number | null;
  within30Percent: number | null;
}

export interface EvaluationSummary {
  count: number;
  /** 형식 실패 등으로 값이 없는 수 */
  failedCount: number;
  /** 값은 있지만 confidence가 기준 미만이라 앱에 내보내지 않는 수 */
  lowConfidenceCount: number;
  /** (실패 + 낮은 confidence) / 전체 */
  heldRate: number;
  /** 앱에 내보내는 추정값 기준 지표 */
  shown: Record<'calories' | 'carbs' | 'protein' | 'fat', NutrientMetric>;
  /** 보류 전(값이 있는 전부) 지표 */
  allValid: Record<'calories' | 'carbs' | 'protein' | 'fat', NutrientMetric>;
  byPath: Record<string, number>;
}

const EVALUATED_NUTRIENTS = ['calories', 'carbs', 'protein', 'fat'] as const;

function nutrientMetrics(
  rows: readonly EvaluationRow[],
): Record<(typeof EVALUATED_NUTRIENTS)[number], NutrientMetric> {
  return Object.fromEntries(
    EVALUATED_NUTRIENTS.map((nutrient) => {
      const pairs = rows
        .map((row) => ({
          truth: row.truth[nutrient],
          estimate: row.record.nutrition?.[nutrient] ?? null,
        }))
        .filter(
          (pair): pair is { truth: number; estimate: number } =>
            pair.truth != null && pair.estimate != null,
        );
      const errors = pairs.map((pair) => Math.abs(pair.estimate - pair.truth));
      const relative = pairs
        .filter((pair) => pair.truth > 0)
        .map((pair) => Math.abs(pair.estimate - pair.truth) / pair.truth);
      return [
        nutrient,
        {
          evaluated: pairs.length,
          mae: errors.length
            ? round(
                errors.reduce((sum, error) => sum + error, 0) / errors.length,
                2,
              )
            : null,
          within30Percent: relative.length
            ? round(
                relative.filter((error) => error <= 0.3).length /
                  relative.length,
                4,
              )
            : null,
        },
      ];
    }),
  ) as Record<(typeof EVALUATED_NUTRIENTS)[number], NutrientMetric>;
}

export function summarizeEvaluation(
  rows: readonly EvaluationRow[],
  minConfidence: number,
): EvaluationSummary {
  const valid = rows.filter(
    (row) => row.record.status === 'ok' && row.record.nutrition != null,
  );
  const shown = valid.filter(
    (row) => (row.record.confidence ?? 0) >= minConfidence,
  );
  const byPath: Record<string, number> = {};
  for (const row of valid) {
    const path = row.record.path ?? row.record.source;
    byPath[path] = (byPath[path] ?? 0) + 1;
  }
  return {
    count: rows.length,
    failedCount: rows.length - valid.length,
    lowConfidenceCount: valid.length - shown.length,
    heldRate: rows.length
      ? round((rows.length - shown.length) / rows.length, 4)
      : 0,
    shown: nutrientMetrics(shown),
    allValid: nutrientMetrics(valid),
    byPath,
  };
}
