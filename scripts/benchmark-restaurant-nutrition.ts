import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { performance } from 'perf_hooks';
import { dirname, resolve } from 'path';

const HEADERS = [
  '메뉴',
  '브랜드',
  '브랜드 카테고리',
  '메뉴 카테고리',
  '중량 단위',
  '중량',
  '단위량',
  '칼로리',
  '탄수화물',
  '당류',
  '당알코올',
  '식이섬유',
  '단백질',
  '지방',
] as const;

export type Nutrient = 'calories' | 'carbs' | 'protein' | 'fat';
export type InputMode = 'name' | 'name_category' | 'name_category_weight';
export type Split = 'known_brand' | 'unseen_brand';

export interface MenuRow {
  id: string;
  name: string;
  brand: string;
  restaurantCategory: string;
  menuCategory: string;
  weight: number | null;
  nutrients: Record<Nutrient, number | null>;
  tokens: Set<string>;
}

export interface Prediction {
  values: Record<Nutrient, number | null>;
  confidence: number | null;
  abstained: boolean;
}

interface BenchmarkOptions {
  csvPath: string;
  outputPath: string;
  sizes: number[];
  testLimit: number;
  topK: number;
  minSimilarity: number;
  seed: string;
}

export interface MethodResult {
  split: Split;
  datasetSize: number;
  actualDatasetSize: number;
  testSize: number;
  inputMode: InputMode;
  method: 'category_mean' | 'similar_menu' | 'embedding_similar_menu';
  topK: number | null;
  minSimilarity: number | null;
  coverage: number;
  abstentionRate: number;
  latencyMs: {
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  nutrients: Record<
    Nutrient,
    {
      evaluated: number;
      mae: number | null;
      mape: number | null;
      within20Percent: number | null;
      within30Percent: number | null;
    }
  >;
}

export const NUTRIENTS: Nutrient[] = ['calories', 'carbs', 'protein', 'fat'];
const INPUT_MODES: InputMode[] = [
  'name',
  'name_category',
  'name_category_weight',
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function nullableNumber(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&amp;|&#038;/g, '&')
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .trim();
}

function textTokens(value: string): Set<string> {
  const compact = normalizeText(value).replace(/\s+/g, '');
  const tokens = new Set<string>();
  if (compact.length === 1) tokens.add(compact);
  for (let index = 0; index < compact.length - 1; index += 1) {
    tokens.add(compact.slice(index, index + 2));
  }
  return tokens;
}

function stableScore(value: string, seed: string): number {
  const hash = createHash('sha256').update(`${seed}:${value}`).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

export function requiredCsvPath(csvPath: string | undefined): string {
  if (!csvPath) {
    throw new Error('--csv=<메뉴 CSV 경로>를 지정해야 합니다.');
  }
  return csvPath;
}

export function readMenus(csvPath: string): MenuRow[] {
  const rows = parseCsv(readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, ''));
  const header = rows[0];
  const indexes = Object.fromEntries(
    HEADERS.map((name) => [name, header.indexOf(name)]),
  ) as Record<(typeof HEADERS)[number], number>;
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new Error('벤치마크에 필요한 CSV 열을 찾지 못했습니다.');
  }

  return rows
    .slice(1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row, index) => {
      const name = row[indexes['메뉴']].trim();
      const brand = row[indexes['브랜드']].trim();
      return {
        id: `${brand}:${name}:${index}`,
        name,
        brand,
        restaurantCategory: row[indexes['브랜드 카테고리']].trim(),
        menuCategory: row[indexes['메뉴 카테고리']].trim(),
        weight: nullableNumber(row[indexes['중량']]),
        nutrients: {
          calories: nullableNumber(row[indexes['칼로리']]),
          carbs: nullableNumber(row[indexes['탄수화물']]),
          protein: nullableNumber(row[indexes['단백질']]),
          fat: nullableNumber(row[indexes['지방']]),
        },
        tokens: textTokens(name),
      };
    })
    .filter((menu) => menu.nutrients.calories != null);
}

export function splitMenus(
  menus: MenuRow[],
  split: Split,
  seed: string,
): { train: MenuRow[]; test: MenuRow[]; testBrands: string[] } {
  if (split === 'unseen_brand') {
    const brands = [...new Set(menus.map((menu) => menu.brand))].sort();
    const testBrands = brands.filter(
      (brand) => stableScore(brand, `${seed}:brand`) < 0.2,
    );
    const selectedBrands = new Set(
      testBrands.length > 0
        ? testBrands
        : brands
            .sort((a, b) => stableScore(a, seed) - stableScore(b, seed))
            .slice(0, Math.max(1, Math.round(brands.length * 0.2))),
    );
    return {
      train: menus.filter((menu) => !selectedBrands.has(menu.brand)),
      test: menus.filter((menu) => selectedBrands.has(menu.brand)),
      testBrands: [...selectedBrands].sort(),
    };
  }

  const test = menus.filter(
    (menu) => stableScore(menu.id, `${seed}:menu`) < 0.2,
  );
  const testIds = new Set(test.map((menu) => menu.id));
  return {
    train: menus.filter((menu) => !testIds.has(menu.id)),
    test,
    testBrands: [...new Set(test.map((menu) => menu.brand))].sort(),
  };
}

export function sampleMenus(
  menus: MenuRow[],
  size: number,
  seed: string,
): MenuRow[] {
  return [...menus]
    .sort((a, b) => stableScore(a.id, seed) - stableScore(b.id, seed))
    .slice(0, Math.min(size, menus.length));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function similarity(
  query: MenuRow,
  candidate: MenuRow,
  mode: InputMode,
): number {
  let score = jaccard(query.tokens, candidate.tokens);
  if (mode !== 'name') {
    if (query.menuCategory && query.menuCategory === candidate.menuCategory) {
      score += 0.25;
    }
    if (
      query.restaurantCategory &&
      query.restaurantCategory === candidate.restaurantCategory
    ) {
      score += 0.15;
    }
    if (query.brand === candidate.brand) score += 0.1;
  }
  return score;
}

export function scaledValue(
  menu: MenuRow,
  nutrient: Nutrient,
  query: MenuRow,
  mode: InputMode,
): number | null {
  const value = menu.nutrients[nutrient];
  if (value == null) return null;
  if (
    mode === 'name_category_weight' &&
    menu.weight != null &&
    menu.weight > 0 &&
    query.weight != null &&
    query.weight > 0
  ) {
    return (value / menu.weight) * query.weight;
  }
  return value;
}

function buildCategoryPredictor(
  train: MenuRow[],
  mode: InputMode,
): (menu: MenuRow) => Prediction {
  const buckets = new Map<string, MenuRow[]>();
  const keys = (menu: MenuRow): string[] => {
    if (mode === 'name') return ['*'];
    return [
      `${menu.restaurantCategory}|${menu.menuCategory}`,
      `${menu.restaurantCategory}|*`,
      '*',
    ];
  };
  for (const menu of train) {
    for (const key of keys(menu)) {
      const bucket = buckets.get(key) ?? [];
      bucket.push(menu);
      buckets.set(key, bucket);
    }
  }
  return (query) => {
    const bucket = keys(query)
      .map((key) => buckets.get(key))
      .find((rows) => rows && rows.length > 0);
    const values = Object.fromEntries(
      NUTRIENTS.map((nutrient) => {
        const available = (bucket ?? [])
          .map((menu) => scaledValue(menu, nutrient, query, mode))
          .filter((value): value is number => value != null);
        return [
          nutrient,
          available.length
            ? available.reduce((sum, value) => sum + value, 0) /
              available.length
            : null,
        ];
      }),
    ) as Record<Nutrient, number | null>;
    return {
      values,
      confidence: bucket?.length ? Math.min(1, bucket.length / 30) : null,
      abstained: values.calories == null,
    };
  };
}

function buildSimilarMenuPredictor(
  train: MenuRow[],
  mode: InputMode,
  topK: number,
  minSimilarity: number,
): (menu: MenuRow) => Prediction {
  return (query) => {
    const neighbors = train
      .map((candidate) => ({
        menu: candidate,
        score: similarity(query, candidate, mode),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    const confidence = neighbors[0]?.score ?? 0;
    if (neighbors.length === 0 || confidence < minSimilarity) {
      return {
        values: { calories: null, carbs: null, protein: null, fat: null },
        confidence,
        abstained: true,
      };
    }
    const values = Object.fromEntries(
      NUTRIENTS.map((nutrient) => {
        const available = neighbors
          .map(({ menu, score }) => ({
            value: scaledValue(menu, nutrient, query, mode),
            weight: Math.max(score, 0.01) ** 2,
          }))
          .filter(
            (item): item is { value: number; weight: number } =>
              item.value != null,
          );
        const weightSum = available.reduce((sum, item) => sum + item.weight, 0);
        return [
          nutrient,
          weightSum > 0
            ? available.reduce(
                (sum, item) => sum + item.value * item.weight,
                0,
              ) / weightSum
            : null,
        ];
      }),
    ) as Record<Nutrient, number | null>;
    return { values, confidence, abstained: values.calories == null };
  };
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function rounded(value: number): number {
  return Number(value.toFixed(4));
}

export function evaluate(
  metadata: Omit<
    MethodResult,
    'coverage' | 'abstentionRate' | 'latencyMs' | 'nutrients'
  >,
  test: MenuRow[],
  predictor: (menu: MenuRow) => Prediction,
): MethodResult {
  const latencies: number[] = [];
  const predictions: Array<{ truth: MenuRow; prediction: Prediction }> = [];
  for (const menu of test) {
    const startedAt = performance.now();
    const prediction = predictor(menu);
    latencies.push(performance.now() - startedAt);
    predictions.push({ truth: menu, prediction });
  }
  const predicted = predictions.filter((item) => !item.prediction.abstained);
  const nutrientMetrics = Object.fromEntries(
    NUTRIENTS.map((nutrient) => {
      const pairs = predicted
        .map(({ truth, prediction }) => ({
          truth: truth.nutrients[nutrient],
          predicted: prediction.values[nutrient],
        }))
        .filter(
          (pair): pair is { truth: number; predicted: number } =>
            pair.truth != null && pair.predicted != null,
        );
      const absoluteErrors = pairs.map((pair) =>
        Math.abs(pair.predicted - pair.truth),
      );
      const relativeErrors = pairs
        .filter((pair) => pair.truth > 0)
        .map((pair) => Math.abs(pair.predicted - pair.truth) / pair.truth);
      return [
        nutrient,
        {
          evaluated: pairs.length,
          mae: pairs.length
            ? rounded(
                absoluteErrors.reduce((sum, value) => sum + value, 0) /
                  pairs.length,
              )
            : null,
          mape: relativeErrors.length
            ? rounded(
                relativeErrors.reduce((sum, value) => sum + value, 0) /
                  relativeErrors.length,
              )
            : null,
          within20Percent: relativeErrors.length
            ? rounded(
                relativeErrors.filter((value) => value <= 0.2).length /
                  relativeErrors.length,
              )
            : null,
          within30Percent: relativeErrors.length
            ? rounded(
                relativeErrors.filter((value) => value <= 0.3).length /
                  relativeErrors.length,
              )
            : null,
        },
      ];
    }),
  ) as MethodResult['nutrients'];
  return {
    ...metadata,
    coverage: rounded(predicted.length / Math.max(test.length, 1)),
    abstentionRate: rounded(1 - predicted.length / Math.max(test.length, 1)),
    latencyMs: {
      mean: rounded(
        latencies.reduce((sum, value) => sum + value, 0) /
          Math.max(latencies.length, 1),
      ),
      p50: rounded(percentile(latencies, 0.5)),
      p95: rounded(percentile(latencies, 0.95)),
      p99: rounded(percentile(latencies, 0.99)),
    },
    nutrients: nutrientMetrics,
  };
}

function parseOptions(): BenchmarkOptions {
  const args = process.argv.slice(2);
  const value = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return args
      .find((argument) => argument.startsWith(prefix))
      ?.slice(prefix.length);
  };
  const sizes = (value('sizes') ?? '250,500,1000,2000,4000')
    .split(',')
    .map(Number)
    .filter((size) => Number.isInteger(size) && size > 0);
  return {
    csvPath: resolve(requiredCsvPath(value('csv'))),
    outputPath: resolve(
      value('output') ?? 'benchmark-results/restaurant-nutrition-baseline.json',
    ),
    sizes,
    testLimit: Number(value('test-limit') ?? 500),
    topK: Number(value('top-k') ?? 5),
    minSimilarity: Number(value('min-similarity') ?? 0.2),
    seed: value('seed') ?? 'restaurant-nutrition-v1',
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const menus = readMenus(options.csvPath);
  const results: MethodResult[] = [];
  const splitSummary: Record<string, unknown> = {};

  for (const split of ['known_brand', 'unseen_brand'] as Split[]) {
    const partition = splitMenus(menus, split, options.seed);
    const test = sampleMenus(
      partition.test,
      options.testLimit,
      `${options.seed}:${split}:test`,
    );
    splitSummary[split] = {
      trainSize: partition.train.length,
      availableTestSize: partition.test.length,
      evaluatedTestSize: test.length,
      testBrands: partition.testBrands,
    };

    for (const requestedSize of options.sizes) {
      const train = sampleMenus(
        partition.train,
        requestedSize,
        `${options.seed}:${split}:train`,
      );
      for (const inputMode of INPUT_MODES) {
        results.push(
          evaluate(
            {
              split,
              datasetSize: requestedSize,
              actualDatasetSize: train.length,
              testSize: test.length,
              inputMode,
              method: 'category_mean',
              topK: null,
              minSimilarity: null,
            },
            test,
            buildCategoryPredictor(train, inputMode),
          ),
        );
        results.push(
          evaluate(
            {
              split,
              datasetSize: requestedSize,
              actualDatasetSize: train.length,
              testSize: test.length,
              inputMode,
              method: 'similar_menu',
              topK: options.topK,
              minSimilarity: options.minSimilarity,
            },
            test,
            buildSimilarMenuPredictor(
              train,
              inputMode,
              options.topK,
              options.minSimilarity,
            ),
          ),
        );
      }
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    options,
    dataset: {
      menuCount: menus.length,
      brandCount: new Set(menus.map((menu) => menu.brand)).size,
      labeledCounts: Object.fromEntries(
        NUTRIENTS.map((nutrient) => [
          nutrient,
          menus.filter((menu) => menu.nutrients[nutrient] != null).length,
        ]),
      ),
    },
    splits: splitSummary,
    results,
  };
  mkdirSync(dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log('[NUTRITION_BENCHMARK] completed', {
    outputPath: options.outputPath,
    menuCount: menus.length,
    resultCount: results.length,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[NUTRITION_BENCHMARK] failed', error);
    process.exitCode = 1;
  });
}
