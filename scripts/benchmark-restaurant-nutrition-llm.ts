import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { performance } from 'perf_hooks';
import { dirname, resolve } from 'path';
import 'dotenv/config';
import {
  MenuRow,
  Nutrient,
  NUTRIENTS,
  readMenus,
  requiredCsvPath,
  sampleMenus,
  Split,
  splitMenus,
} from './benchmark-restaurant-nutrition';

export type Method = 'llm_only' | 'hybrid_rag';
type Estimate = Record<Nutrient, number> & { confidence: number };
type PredictionRow = {
  split: Split;
  method: Method;
  menuId: string;
  name: string;
  brand: string;
  truth: Record<Nutrient, number | null>;
  estimate: Estimate | null;
  latencyMs: number;
  error: string | null;
};
type EmbeddingCache = Record<string, number[]>;

const seed = 'restaurant-nutrition-v1';
const dimension = 128;
const inputMode = 'name_category';
type InputProfile = 'catalog_context' | 'name_only';

function inputText(menu: MenuRow): string {
  return `메뉴명: ${menu.name}\n브랜드: ${menu.brand}\n식당 카테고리: ${menu.restaurantCategory}\n메뉴 카테고리: ${menu.menuCategory}`;
}

export function embeddingKey(
  menu: MenuRow,
  mode: 'name' | 'name_category' = inputMode,
): string {
  const text = mode === 'name' ? `메뉴명: ${menu.name}` : inputText(menu);
  return createHash('sha256')
    .update(`${dimension}:${mode}:${text}`)
    .digest('hex');
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, '');
}

function bigrams(value: string): Set<string> {
  const normalized = normalize(value);
  const output = new Set<string>();
  if (normalized.length === 1) output.add(normalized);
  for (let index = 0; index < normalized.length - 1; index += 1) {
    output.add(normalized.slice(index, index + 2));
  }
  return output;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return dot / Math.max(Math.sqrt(leftNorm * rightNorm), Number.EPSILON);
}

function hybridNeighbors(
  query: MenuRow,
  train: MenuRow[],
  cache: EmbeddingCache,
  profile: InputProfile,
): MenuRow[] {
  const queryTokens = bigrams(query.name);
  const mode = profile === 'name_only' ? 'name' : 'name_category';
  const queryEmbedding = cache[embeddingKey(query, mode)];
  return train
    .map((menu) => {
      const lexical = jaccard(queryTokens, bigrams(menu.name));
      const semantic = cosine(queryEmbedding, cache[embeddingKey(menu, mode)]);
      const category = profile === 'name_only'
        ? 0
        : (query.restaurantCategory === menu.restaurantCategory ? 0.08 : 0) +
          (query.menuCategory === menu.menuCategory ? 0.12 : 0);
      return { menu, score: lexical * 0.45 + semantic * 0.55 + category };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map((item) => item.menu);
}

export function promptFor(
  batch: MenuRow[],
  method: Method,
  train: MenuRow[],
  cache: EmbeddingCache,
  profile: InputProfile = 'catalog_context',
): string {
  const items = batch.map((menu) => ({
    id: menu.id,
    menu: profile === 'name_only'
      ? { name: menu.name }
      : {
          name: menu.name,
          brand: menu.brand,
          restaurantCategory: menu.restaurantCategory,
          menuCategory: menu.menuCategory,
          weightG: menu.weight,
        },
    ...(method === 'hybrid_rag'
      ? {
          referenceMenus: hybridNeighbors(menu, train, cache, profile).map((neighbor) =>
            profile === 'name_only'
              ? { name: neighbor.name, nutrition: neighbor.nutrients }
              : {
                  name: neighbor.name,
                  brand: neighbor.brand,
                  restaurantCategory: neighbor.restaurantCategory,
                  menuCategory: neighbor.menuCategory,
                  weightG: neighbor.weight,
                  nutrition: neighbor.nutrients,
                },
          ),
        }
      : {}),
  }));
  return `한국 식당 메뉴의 1개 메뉴 전체 기준 영양성분을 추정해. 목표 메뉴의 실제 영양정보는 입력에서 숨겨져 있어.
규칙:
- calories(kcal), carbs(g), protein(g), fat(g)을 모두 0 이상의 숫자로 반환해.
- ${profile === 'name_only' ? '입력으로 메뉴명만 제공돼. 브랜드·카테고리·중량을 추측해서 입력 사실처럼 사용하지 마.' : 'weightG가 있으면 반드시 해당 중량 전체 기준으로 계산해.'}
- referenceMenus는 공식 영양정보가 있는 유사 메뉴 근거이며 목표 메뉴와 완전히 같다고 가정하지 마.
- confidence는 0~1 사이 숫자야. 메뉴 구성이나 중량이 불명확하면 낮게 줘.
- 설명 없이 JSON 배열만 반환해. 입력 순서와 id를 보존해.
형식: [{"id":"...","calories":0,"carbs":0,"protein":0,"fat":0,"confidence":0}]
입력:
${JSON.stringify(items)}`;
}

export async function requestGemini(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<{ values: Array<{ id: string } & Estimate>; usage: Record<string, number>; latencyMs: number }> {
  const startedAt = performance.now();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    },
  );
  const body = (await response.json()) as any;
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${JSON.stringify(body)}`);
  const text = body.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? '').join('');
  if (!text) throw new Error('Gemini returned empty content');
  const values = JSON.parse(text) as Array<{ id: string } & Estimate>;
  return {
    values,
    usage: body.usageMetadata ?? {},
    latencyMs: performance.now() - startedAt,
  };
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

function summarize(rows: PredictionRow[]): Record<string, unknown> {
  const successful = rows.filter((row) => row.estimate);
  const nutrientMetrics = Object.fromEntries(
    NUTRIENTS.map((nutrient) => {
      const pairs = successful
        .filter((row) => row.truth[nutrient] != null)
        .map((row) => ({ truth: row.truth[nutrient]!, estimate: row.estimate![nutrient] }));
      const errors = pairs.map((pair) => Math.abs(pair.estimate - pair.truth));
      const relative = pairs
        .filter((pair) => pair.truth > 0)
        .map((pair) => Math.abs(pair.estimate - pair.truth) / pair.truth);
      return [nutrient, {
        evaluated: pairs.length,
        mae: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null,
        within20Percent: relative.length ? relative.filter((value) => value <= 0.2).length / relative.length : null,
        within30Percent: relative.length ? relative.filter((value) => value <= 0.3).length / relative.length : null,
      }];
    }),
  );
  const latencies = successful.map((row) => row.latencyMs);
  return {
    requested: rows.length,
    successful: successful.length,
    failureRate: 1 - successful.length / Math.max(rows.length, 1),
    meanConfidence: successful.reduce((sum, row) => sum + row.estimate!.confidence, 0) / Math.max(successful.length, 1),
    latencyMs: {
      mean: latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1),
      p95: percentile(latencies, 0.95),
    },
    nutrients: nutrientMetrics,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const arg = (name: string, fallback: string): string =>
    args.find((item) => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
  const csvPath = resolve(requiredCsvPath(arg('csv', '') || undefined));
  const outputPath = resolve(arg('output', 'benchmark-results/restaurant-nutrition-llm.json'));
  const cachePath = resolve(arg('embedding-cache', 'benchmark-results/cache/menu-embeddings.json'));
  const checkpointPath = resolve(arg('checkpoint', 'benchmark-results/cache/llm-predictions.json'));
  const testLimit = Number(arg('test-limit', '100'));
  const batchSize = Number(arg('batch-size', '10'));
  const inputProfile = arg('input-profile', 'catalog_context') as InputProfile;
  if (!['catalog_context', 'name_only'].includes(inputProfile)) {
    throw new Error(`Unsupported input profile: ${inputProfile}`);
  }
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  if (!existsSync(cachePath)) throw new Error('Embedding cache is required');
  const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as EmbeddingCache;
  const menus = readMenus(csvPath);
  const checkpoint = existsSync(checkpointPath)
    ? (JSON.parse(readFileSync(checkpointPath, 'utf8')) as { rows: PredictionRow[]; usage: Record<string, number> })
    : { rows: [], usage: {} };
  for (const row of checkpoint.rows) {
    if (!row.estimate) continue;
    const rawValues = [...NUTRIENTS, 'confidence'].map(
      (key) => row.estimate![key],
    );
    if (
      rawValues.some(
        (value) => value == null || value === '' || !Number.isFinite(Number(value)),
      )
    ) {
      row.estimate = null;
      row.error = row.error ?? 'invalid numeric response';
      continue;
    }
    for (const key of [...NUTRIENTS, 'confidence'] as const) {
      row.estimate[key] = Number(row.estimate[key]);
    }
  }
  const completed = new Set(checkpoint.rows.map((row) => `${row.split}:${row.method}:${row.menuId}`));
  for (const split of ['known_brand', 'unseen_brand'] as Split[]) {
    const partition = splitMenus(menus, split, seed);
    const train = sampleMenus(partition.train, 4000, `${seed}:${split}:train`);
    const test = sampleMenus(partition.test, testLimit, `${seed}:${split}:test`);
    for (const method of ['llm_only', 'hybrid_rag'] as Method[]) {
      const pending = test.filter((menu) => !completed.has(`${split}:${method}:${menu.id}`));
      for (let index = 0; index < pending.length; index += batchSize) {
        const batch = pending.slice(index, index + batchSize);
        let response: Awaited<ReturnType<typeof requestGemini>> | null = null;
        let errorMessage: string | null = null;
        for (let attempt = 1; attempt <= 3 && !response; attempt += 1) {
          try {
            response = await requestGemini(
              promptFor(batch, method, train, cache, inputProfile),
              model,
              apiKey,
            );
          } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
            if (attempt < 3) await new Promise((resolveWait) => setTimeout(resolveWait, 2000 * attempt));
          }
        }
        const byId = new Map(response?.values.map((value) => [value.id, value]) ?? []);
        for (const menu of batch) {
          const estimate = byId.get(menu.id) ?? null;
          checkpoint.rows.push({
            split,
            method,
            menuId: menu.id,
            name: menu.name,
            brand: menu.brand,
            truth: menu.nutrients,
            estimate,
            latencyMs: response ? response.latencyMs / batch.length : 0,
            error: estimate ? null : errorMessage ?? 'missing response item',
          });
        }
        for (const [key, value] of Object.entries(response?.usage ?? {})) {
          if (typeof value === 'number') checkpoint.usage[key] = (checkpoint.usage[key] ?? 0) + value;
        }
        mkdirSync(dirname(checkpointPath), { recursive: true });
        writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
        console.log('[LLM_BENCHMARK] progress', { split, method, completed: index + batch.length, total: pending.length });
      }
    }
  }
  const summaries = Object.fromEntries(
    (['known_brand', 'unseen_brand'] as Split[]).flatMap((split) =>
      (['llm_only', 'hybrid_rag'] as Method[]).map((method) => [
        `${split}:${method}`,
        summarize(checkpoint.rows.filter((row) => row.split === split && row.method === method)),
      ]),
    ),
  );
  const output = { generatedAt: new Date().toISOString(), model, inputProfile, testLimit, batchSize, usage: checkpoint.usage, summaries, predictions: checkpoint.rows };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log('[LLM_BENCHMARK] completed', { outputPath, predictionCount: checkpoint.rows.length });
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[LLM_BENCHMARK] failed', error);
    process.exitCode = 1;
  });
}
