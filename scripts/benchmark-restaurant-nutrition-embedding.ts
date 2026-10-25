import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { performance } from 'perf_hooks';
import { dirname, resolve } from 'path';
import 'dotenv/config';
import {
  evaluate,
  InputMode,
  MenuRow,
  NUTRIENTS,
  Prediction,
  readMenus,
  requiredCsvPath,
  sampleMenus,
  scaledValue,
  Split,
  splitMenus,
} from './benchmark-restaurant-nutrition';

type Cache = Record<string, number[]>;

interface Options {
  csvPath: string;
  outputPath: string;
  cachePath: string;
  sizes: number[];
  testLimit: number;
  topK: number;
  minSimilarity: number;
  seed: string;
  dimension: number;
  batchSize: number;
  modes: InputMode[];
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const value = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };
  return {
    csvPath: resolve(requiredCsvPath(value('csv'))),
    outputPath: resolve(
      value('output') ??
        'benchmark-results/restaurant-nutrition-embedding.json',
    ),
    cachePath: resolve(
      value('cache') ?? 'benchmark-results/cache/menu-embeddings.json',
    ),
    sizes: (value('sizes') ?? '250,500,1000,2000,4000')
      .split(',')
      .map(Number)
      .filter((size) => Number.isInteger(size) && size > 0),
    testLimit: Number(value('test-limit') ?? 100),
    topK: Number(value('top-k') ?? 5),
    minSimilarity: Number(value('min-similarity') ?? 0.45),
    seed: value('seed') ?? 'restaurant-nutrition-v1',
    dimension: Number(value('dimension') ?? 128),
    batchSize: Number(value('batch-size') ?? 50),
    modes: (value('modes') ?? 'name,name_category,name_category_weight')
      .split(',')
      .filter((mode): mode is InputMode =>
        ['name', 'name_category', 'name_category_weight'].includes(mode),
      ),
  };
}

function inputText(menu: MenuRow, mode: InputMode): string {
  if (mode === 'name') return `메뉴명: ${menu.name}`;
  const category = `브랜드: ${menu.brand}\n식당 카테고리: ${menu.restaurantCategory}\n메뉴 카테고리: ${menu.menuCategory}`;
  if (mode === 'name_category') return `메뉴명: ${menu.name}\n${category}`;
  return `메뉴명: ${menu.name}\n${category}\n중량: ${menu.weight ?? '알 수 없음'}g`;
}

function keyFor(menu: MenuRow, mode: InputMode, dimension: number): string {
  return createHash('sha256')
    .update(`${dimension}:${mode}:${inputText(menu, mode)}`)
    .digest('hex');
}

async function embedBatch(
  texts: string[],
  model: string,
  dimension: number,
  apiKey: string,
): Promise<number[][]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType: 'SEMANTIC_SIMILARITY',
          outputDimensionality: dimension,
        })),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini embedding HTTP ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as {
    embeddings?: Array<{ values?: number[] }>;
  };
  const embeddings = body.embeddings?.map((item) => item.values ?? []) ?? [];
  if (
    embeddings.length !== texts.length ||
    embeddings.some((embedding) => embedding.length !== dimension)
  ) {
    throw new Error('Gemini batch embedding response shape mismatch');
  }
  return embeddings;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function ensureEmbeddings(
  menus: MenuRow[],
  options: Options,
): Promise<{ cache: Cache; apiRequests: number; embeddedTexts: number; apiMs: number }> {
  const cache: Cache = existsSync(options.cachePath)
    ? (JSON.parse(readFileSync(options.cachePath, 'utf8')) as Cache)
    : {};
  const missing: Array<{ key: string; text: string }> = [];
  for (const mode of options.modes) {
    for (const menu of menus) {
      const key = keyFor(menu, mode, options.dimension);
      if (!cache[key]) missing.push({ key, text: inputText(menu, mode) });
    }
  }
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001';
  if (missing.length && !apiKey) throw new Error('GEMINI_API_KEY is required');
  let apiRequests = 0;
  const startedAt = performance.now();
  for (let index = 0; index < missing.length; index += options.batchSize) {
    const batch = missing.slice(index, index + options.batchSize);
    let embeddings: number[][] | null = null;
    for (let attempt = 1; attempt <= 5 && !embeddings; attempt += 1) {
      const batchStartedAt = performance.now();
      try {
        embeddings = await embedBatch(
          batch.map((item) => item.text),
          model,
          options.dimension,
          apiKey!,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('HTTP 429') || attempt === 5) throw error;
        const seconds = Number(message.match(/retry in ([0-9.]+)s/i)?.[1] ?? 60);
        const retryMs = Math.min(60_000, Math.max(5_000, seconds * 1000 + 1000));
        console.warn('[EMBEDDING_BENCHMARK] rate limited; retrying', {
          attempt,
          retryAfterMs: Math.round(retryMs),
        });
        await wait(retryMs);
      }
      const elapsed = performance.now() - batchStartedAt;
      if (embeddings && elapsed < 1100) await wait(1100 - elapsed);
    }
    if (!embeddings) throw new Error('Embedding retry loop completed without data');
    batch.forEach((item, batchIndex) => {
      cache[item.key] = embeddings[batchIndex];
    });
    apiRequests += 1;
    if (apiRequests % 10 === 0 || index + batch.length === missing.length) {
      mkdirSync(dirname(options.cachePath), { recursive: true });
      writeFileSync(options.cachePath, `${JSON.stringify(cache)}\n`);
      console.log('[EMBEDDING_BENCHMARK] embedding progress', {
        completed: index + batch.length,
        total: missing.length,
      });
    }
  }
  return {
    cache,
    apiRequests,
    embeddedTexts: missing.length,
    apiMs: performance.now() - startedAt,
  };
}

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  return dot / Math.max(Math.sqrt(leftNorm * rightNorm), Number.EPSILON);
}

function predictor(
  train: MenuRow[],
  mode: InputMode,
  cache: Cache,
  options: Options,
): (query: MenuRow) => Prediction {
  return (query) => {
    const queryEmbedding = cache[keyFor(query, mode, options.dimension)];
    const neighbors = train
      .map((menu) => ({
        menu,
        score: cosine(
          queryEmbedding,
          cache[keyFor(menu, mode, options.dimension)],
        ),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, options.topK);
    const confidence = neighbors[0]?.score ?? 0;
    if (!neighbors.length || confidence < options.minSimilarity) {
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
          weightSum
            ? available.reduce(
                (sum, item) => sum + item.value * item.weight,
                0,
              ) / weightSum
            : null,
        ];
      }),
    ) as Prediction['values'];
    return { values, confidence, abstained: values.calories == null };
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const menus = readMenus(options.csvPath);
  const embedding = await ensureEmbeddings(menus, options);
  const results = [];
  const splits: Record<string, unknown> = {};
  for (const split of ['known_brand', 'unseen_brand'] as Split[]) {
    const partition = splitMenus(menus, split, options.seed);
    const test = sampleMenus(
      partition.test,
      options.testLimit,
      `${options.seed}:${split}:test`,
    );
    splits[split] = {
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
      for (const mode of options.modes) {
        results.push(
          evaluate(
            {
              split,
              datasetSize: requestedSize,
              actualDatasetSize: train.length,
              testSize: test.length,
              inputMode: mode,
              method: 'embedding_similar_menu',
              topK: options.topK,
              minSimilarity: options.minSimilarity,
            },
            test,
            predictor(train, mode, embedding.cache, options),
          ),
        );
      }
    }
  }
  const output = {
    generatedAt: new Date().toISOString(),
    options: { ...options, csvPath: options.csvPath, cachePath: options.cachePath },
    api: {
      model: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
      requests: embedding.apiRequests,
      embeddedTexts: embedding.embeddedTexts,
      elapsedMs: Number(embedding.apiMs.toFixed(2)),
      reusedFromCache: menus.length * options.modes.length - embedding.embeddedTexts,
    },
    splits,
    results,
  };
  mkdirSync(dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log('[EMBEDDING_BENCHMARK] completed', {
    outputPath: options.outputPath,
    resultCount: results.length,
  });
}

main().catch((error) => {
  console.error('[EMBEDDING_BENCHMARK] failed', error);
  process.exitCode = 1;
});
