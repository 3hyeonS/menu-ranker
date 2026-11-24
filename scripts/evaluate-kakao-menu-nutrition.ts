import 'reflect-metadata';
import 'dotenv/config';
import { HttpService } from '@nestjs/axios';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { HttpGeminiClient } from '../src/gemini/http-gemini.client';
import { MIN_DISPLAY_ESTIMATE_CONFIDENCE } from '../src/restaurant/branch-menu-estimate.constants';
import { arg, assertUntrackedOutput, intArg } from './crawl-common/crawl-cli';
import { readJsonLines } from './crawl-common/crawl-files';
import {
  buildBrandEvaluationTargets,
  buildMfdsIndex,
  collectMenuNameTargets,
  costUsd,
  DEFAULT_ESTIMATE_MODEL,
  DEFAULT_FALLBACK_THRESHOLD,
  EstimateRecord,
  estimateRun,
  NutritionValues,
  parseEstimateRecord,
  RAG_REFERENCE_LIMIT,
  ReferenceIndex,
  summarizeEvaluation,
  TokenPrices,
} from './kakao-map/kakao-menu-nutrition';
import {
  EstimatorTarget,
  MenuNutritionEstimator,
} from './kakao-map/kakao-menu-nutrition-estimator';
import {
  brandsFromReferences,
  readKakaoMenus,
  readMfdsFile,
  readMfdsFromDatabase,
  readReferenceMenus,
} from './kakao-map/kakao-menu-nutrition-input';

// 시범 평가(#41 할 일 3): 정답이 있는 메뉴를 추정 파이프라인(RAG → 재추정)에 그대로 넣어 오차를 잰다.
//   mfds:  개인 식당 메뉴 중 식약처 음식명과 정확히 같은 이름(정답 = 식약처 값). 본 실행에서는 LLM을 부르지 않는 이름이다.
//   brand: 브랜드 연결 지점의 카카오 메뉴 중 같은 브랜드 공식 메뉴와 이름이 같은 것(정답 = 공식 값).
//          그 브랜드 공식 메뉴는 근거에서 빼서 개인 식당(미관측 브랜드)처럼 평가한다.
// 각 표본은 매장 수가 많은 순서로 --sample개다. 예측은 JSONL로 남기고 다시 실행하면 이어서 한다.

type EvaluationSet = 'mfds' | 'brand';
type EvaluationTarget = EstimatorTarget & {
  set: EvaluationSet;
  truth: NutritionValues;
  storeCount: number;
};
type PredictionLine = {
  set: EvaluationSet;
  truth: NutritionValues;
  record: EstimateRecord;
};

const DEFAULT_OUTPUT = 'kakao-map/nutrition-estimate/evaluation.jsonl';
const DEFAULT_PRICES: TokenPrices = { input: 0.1, output: 0.4 };

function numberArg(name: string, fallback: number, min: number, max: number) {
  const raw = arg(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`--${name}는 ${min}~${max} 사이 숫자여야 합니다: ${raw}`);
  }
  return value;
}

function readPredictions(path: string): PredictionLine[] {
  if (!existsSync(path)) return [];
  return readJsonLines<PredictionLine>(path).filter(
    (line) =>
      (line?.set === 'mfds' || line?.set === 'brand') &&
      line.truth != null &&
      parseEstimateRecord(line.record) != null,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dirs = args
    .filter((value) => !value.startsWith('--'))
    .map((path) => resolve(process.cwd(), path));
  const referencesPath = arg('references');
  if (dirs.length === 0 || !referencesPath) {
    throw new Error(
      '사용법: npm run restaurant:menu-nutrition:evaluate -- kakao-map/*구/ --references=brand-nutrition/all-menus.csv [--mfds-file=<json>] [--sample=200] [--dry-run]',
    );
  }
  const outputPath = resolve(process.cwd(), arg('output') ?? DEFAULT_OUTPUT);
  const summaryPath = resolve(
    process.cwd(),
    arg('summary-output') ??
      outputPath.replace(/\.jsonl$/, '') + '-summary.json',
  );
  const sample = intArg('sample', 200, 1);
  const batchSize = intArg('batch-size', 10, 1, 50);
  const concurrency = intArg('concurrency', 3, 1, 50);
  const rpm = intArg('rpm', 300, 1, 10_000);
  const maxRetries = intArg('max-retries', 3, 0, 10);
  const timeoutMs = intArg('timeout-ms', 30_000, 1_000, 300_000);
  const fallbackThreshold = numberArg(
    'fallback-threshold',
    DEFAULT_FALLBACK_THRESHOLD,
    0,
    1,
  );
  const model = arg('model') ?? DEFAULT_ESTIMATE_MODEL;
  const referenceLimit = intArg('reference-limit', RAG_REFERENCE_LIMIT, 1, 20);
  const prices: TokenPrices = {
    input: numberArg('input-price', DEFAULT_PRICES.input, 0, 100),
    output: numberArg('output-price', DEFAULT_PRICES.output, 0, 100),
  };
  if (!dryRun) {
    // git check-ignore를 출력 폴더에서 실행하므로 폴더를 먼저 만든다.
    mkdirSync(dirname(outputPath), { recursive: true });
    mkdirSync(dirname(summaryPath), { recursive: true });
    assertUntrackedOutput(outputPath, DEFAULT_OUTPUT);
    assertUntrackedOutput(summaryPath, DEFAULT_OUTPUT);
  }

  const references = readReferenceMenus(resolve(process.cwd(), referencesPath));
  // 평가 정답이 근거 CSV이므로 브랜드도 근거 CSV 이름으로 매칭한다.
  const kakao = readKakaoMenus(dirs, brandsFromReferences(references));
  const mfdsFile = arg('mfds-file');
  const mfdsIndex = buildMfdsIndex(
    mfdsFile
      ? readMfdsFile(resolve(process.cwd(), mfdsFile))
      : await readMfdsFromDatabase(),
  );

  const mfdsTargets: EvaluationTarget[] = collectMenuNameTargets(
    kakao.independentRows,
    kakao.categoryByPlaceId,
  )
    .targets.filter((target) => mfdsIndex.has(target.key))
    .slice(0, sample)
    .map((target) => ({
      key: `mfds:${target.key}`,
      sampleName: target.sampleName,
      restaurantCategory: target.restaurantCategory,
      set: 'mfds',
      truth: { ...mfdsIndex.get(target.key).nutrition },
      storeCount: target.storeCount,
    }));
  const brandTargets: EvaluationTarget[] = buildBrandEvaluationTargets(
    kakao.brandRows,
    references,
    kakao.categoryByPlaceId,
  )
    .slice(0, sample)
    .map((target) => ({
      key: `brand:${target.brand}:${target.key}`,
      sampleName: target.sampleName,
      restaurantCategory: target.restaurantCategory,
      excludeBrand: target.brand,
      set: 'brand',
      truth: target.truth,
      storeCount: target.storeCount,
    }));
  const targets = [...mfdsTargets, ...brandTargets];
  const previous = readPredictions(outputPath);
  const done = new Set(
    previous
      .filter((line) => line.record.status === 'ok')
      .map((line) => line.record.normalizedName),
  );
  const pending = targets.filter((target) => !done.has(target.key));
  const index = new ReferenceIndex(references);
  console.log('[MENU_NUTRITION_EVALUATE] input', {
    mfdsSampleCount: mfdsTargets.length,
    brandSampleCount: brandTargets.length,
    brandSampleBrands: [...new Set(brandTargets.map((t) => t.excludeBrand))]
      .length,
    alreadyDoneCount: targets.length - pending.length,
    pendingCount: pending.length,
  });

  if (dryRun) {
    // 평가 표본은 근거에서 자기 브랜드를 빼므로 실제와 조금 다를 수 있다.
    console.log('[MENU_NUTRITION_EVALUATE] dry-run estimate', {
      model,
      fallbackThreshold,
      referenceLimit,
      prices,
      ...estimateRun(pending, index, {
        batchSize,
        concurrency,
        rpm,
        fallbackThreshold,
        prices,
        referenceLimit,
      }),
    });
    return;
  }

  const lines = previous.filter((line) =>
    targets.some((target) => target.key === line.record.normalizedName),
  );
  if (pending.length > 0) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY가 필요합니다.');
    }
    const estimator = new MenuNutritionEstimator<EvaluationTarget>({
      client: new HttpGeminiClient(new HttpService()),
      references: index,
      model,
      batchSize,
      concurrency,
      minRequestIntervalMs: Math.ceil(60_000 / rpm),
      maxRetries,
      retryBaseDelayMs: 2_000,
      fallbackThreshold,
      timeoutMs,
      referenceLimit,
      onRecord: (record, target) => {
        const line: PredictionLine = {
          set: target.set,
          truth: target.truth,
          record: { ...record, storeCount: target.storeCount },
        };
        lines.push(line);
        appendFileSync(outputPath, `${JSON.stringify(line)}\n`, 'utf8');
      },
    });
    const stats = await estimator.run(pending);
    console.log('[MENU_NUTRITION_EVALUATE] estimated', {
      ...stats,
      costUsd: costUsd(stats.inputTokens, stats.outputTokens, prices),
    });
  }

  // 같은 표본을 여러 번 돌렸으면 마지막 줄을 쓴다.
  const latest = new Map(
    lines.map((line) => [line.record.normalizedName, line]),
  );
  const rows = [...latest.values()];
  const tokens = rows.reduce(
    (sum, line) => ({
      input: sum.input + (line.record.inputTokens ?? 0),
      output: sum.output + (line.record.outputTokens ?? 0),
    }),
    { input: 0, output: 0 },
  );
  const summary = {
    generatedAt: new Date().toISOString(),
    model,
    fallbackThreshold,
    minDisplayConfidence: MIN_DISPLAY_ESTIMATE_CONFIDENCE,
    sample,
    mfds: summarizeEvaluation(
      rows.filter((line) => line.set === 'mfds'),
      MIN_DISPLAY_ESTIMATE_CONFIDENCE,
    ),
    brand: summarizeEvaluation(
      rows.filter((line) => line.set === 'brand'),
      MIN_DISPLAY_ESTIMATE_CONFIDENCE,
    ),
    tokens: {
      ...tokens,
      perMenuInput: rows.length ? tokens.input / rows.length : 0,
      perMenuOutput: rows.length ? tokens.output / rows.length : 0,
      costUsd: costUsd(tokens.input, tokens.output, prices),
      prices,
    },
  };
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(
    '[MENU_NUTRITION_EVALUATE] summary',
    JSON.stringify(summary, null, 2),
  );
}

main().catch((error) => {
  console.error('[MENU_NUTRITION_EVALUATE] failed', error);
  process.exitCode = 1;
});
