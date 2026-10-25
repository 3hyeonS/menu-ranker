import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { performance } from 'perf_hooks';
import { dirname, resolve } from 'path';
import 'dotenv/config';
import {
  promptFor,
  requestGemini,
} from './benchmark-restaurant-nutrition-llm';
import {
  MenuRow,
  readMenus,
  requiredCsvPath,
  sampleMenus,
  splitMenus,
} from './benchmark-restaurant-nutrition';

type EmbeddingCache = Record<string, number[]>;

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    }),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const arg = (name: string, fallback: string): string =>
    args.find((item) => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
  const csvPath = resolve(requiredCsvPath(arg('csv', '') || undefined));
  const cachePath = resolve(arg('embedding-cache', 'benchmark-results/cache/menu-embeddings.json'));
  const outputPath = resolve(arg('output', 'benchmark-results/restaurant-nutrition-load-test.json'));
  const sampleSize = Number(arg('sample-size', '20'));
  const levels = arg('concurrency', '1,3,5').split(',').map(Number);
  const durationSeconds = Number(arg('duration-seconds', '0'));
  const maxRequests = Number(arg('max-requests', '1000'));
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  if (!existsSync(cachePath)) throw new Error('Embedding cache is required');
  const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as EmbeddingCache;
  const menus = readMenus(csvPath);
  const partition = splitMenus(menus, 'known_brand', 'restaurant-nutrition-v1');
  const train = sampleMenus(partition.train, 4000, 'restaurant-nutrition-v1:known_brand:train');
  const test = sampleMenus(partition.test, sampleSize, 'restaurant-nutrition-v1:known_brand:test');
  const results = [];
  for (const concurrency of levels) {
    const latencies: number[] = [];
    const errors: string[] = [];
    const usage: Record<string, number> = {};
    const startedAt = performance.now();
    const deadline =
      durationSeconds > 0 ? startedAt + durationSeconds * 1000 : null;
    let issued = 0;
    const execute = async (menu: MenuRow): Promise<void> => {
      try {
        const response = await requestGemini(
          promptFor([menu], 'hybrid_rag', train, cache),
          model,
          apiKey,
        );
        latencies.push(response.latencyMs);
        for (const [key, value] of Object.entries(response.usage)) {
          if (typeof value === 'number') usage[key] = (usage[key] ?? 0) + value;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    };
    if (deadline == null) {
      await runPool(test, concurrency, execute);
    } else {
      await Promise.all(
        Array.from({ length: concurrency }, async (_, workerIndex) => {
          let menuIndex = workerIndex;
          while (performance.now() < deadline && issued < maxRequests) {
            const menu = test[menuIndex % test.length];
            menuIndex += concurrency;
            issued += 1;
            await execute(menu);
          }
        }),
      );
    }
    const wallMs = performance.now() - startedAt;
    results.push({
      concurrency,
      requested: deadline == null ? test.length : issued,
      successful: latencies.length,
      failed: errors.length,
      rateLimited: errors.filter((error) => error.includes('HTTP 429')).length,
      wallMs,
      throughputPerSecond: latencies.length / (wallMs / 1000),
      latencyMs: {
        mean: latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1),
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
      },
      usage,
      errors: errors.slice(0, 3),
    });
    console.log('[NUTRITION_LOAD_TEST] level completed', results.at(-1));
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), model, sampleSize, durationSeconds, maxRequests, results }, null, 2)}\n`);
  console.log('[NUTRITION_LOAD_TEST] completed', { outputPath });
}

main().catch((error) => {
  console.error('[NUTRITION_LOAD_TEST] failed', error);
  process.exitCode = 1;
});
