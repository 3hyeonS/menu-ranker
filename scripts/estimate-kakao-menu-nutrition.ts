import 'reflect-metadata';
import 'dotenv/config';
import { HttpService } from '@nestjs/axios';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { HttpGeminiClient } from '../src/gemini/http-gemini.client';
import { arg, assertUntrackedOutput, intArg } from './crawl-common/crawl-cli';
import { readJsonLines } from './crawl-common/crawl-files';
import {
  buildMfdsIndex,
  collectMenuNameTargets,
  costUsd,
  DEFAULT_ESTIMATE_MODEL,
  DEFAULT_FALLBACK_THRESHOLD,
  EstimateRecord,
  estimateRun,
  MenuNameTarget,
  mfdsRecord,
  parseEstimateRecord,
  RAG_REFERENCE_LIMIT,
  ReferenceIndex,
  TokenPrices,
} from './kakao-map/kakao-menu-nutrition';
import { MenuNutritionEstimator } from './kakao-map/kakao-menu-nutrition-estimator';
import {
  brandsFromReferences,
  readBrandsFile,
  readKakaoMenus,
  readMfdsFile,
  readMfdsFromDatabase,
  readReferenceMenus,
} from './kakao-map/kakao-menu-nutrition-input';

// 카카오 개인 식당 메뉴명을 정규화 이름 단위로 영양 추정해 JSONL로 쓴다(#41). DB에는 쓰지 않는다.
// 적재는 restaurant:menu-nutrition:import가 따로 한다.
//   1. 구 폴더에서 개인 식당(브랜드 미연결) 메뉴를 읽어 정규화 이름별 매장 수 순으로 정렬, --limit개 선택
//   2. 식약처 음식명과 정확히 같으면 LLM 없이 식약처 값
//   3. 나머지는 공식 브랜드 유사 메뉴 8개를 근거로 10개 묶음 Gemini 호출(RAG), confidence < 0.7이면 순수 LLM 재추정
// 이미 결과 파일에 성공(ok)으로 있는 이름은 건너뛴다(중단 후 같은 명령으로 이어서 실행).

const DEFAULT_OUTPUT = 'kakao-map/nutrition-estimate/estimates.jsonl';
// Standard 가격(2026-10-18, 1M 토큰당 USD). 실행 전 현재 단가를 다시 확인하고 --input-price/--output-price로 바꾼다.
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

function readDoneKeys(path: string): Set<string> {
  const done = new Set<string>();
  if (!existsSync(path)) return done;
  for (const row of readJsonLines<unknown>(path)) {
    const record = parseEstimateRecord(row);
    if (record?.status === 'ok') done.add(record.normalizedName);
  }
  return done;
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function sizeMarkSummary(targets: readonly MenuNameTarget[]) {
  const rows = targets.reduce((sum, target) => sum + target.rowCount, 0);
  const marked = targets.reduce(
    (sum, target) => sum + target.sizeMarkedRowCount,
    0,
  );
  return {
    sizeMarkedRowCount: marked,
    sizeMarkedRowShare: rows ? round(marked / rows) : 0,
    namesWithSizeMarkedRows: targets.filter(
      (target) => target.sizeMarkedRowCount > 0,
    ).length,
  };
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
      '사용법: npm run restaurant:menu-nutrition:estimate -- kakao-map/*구/ --references=brand-nutrition/all-menus.csv [--mfds-file=<json>] [--limit=20000] [--dry-run]',
    );
  }
  const outputPath = resolve(process.cwd(), arg('output') ?? DEFAULT_OUTPUT);
  const limit = intArg('limit', 20_000, 1);
  const batchSize = intArg('batch-size', 10, 1, 50);
  const concurrency = intArg('concurrency', 5, 1, 50);
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
    assertUntrackedOutput(outputPath, DEFAULT_OUTPUT);
  }

  const references = readReferenceMenus(resolve(process.cwd(), referencesPath));
  const brandsFile = arg('brands-file');
  const brands = brandsFile
    ? readBrandsFile(resolve(process.cwd(), brandsFile))
    : brandsFromReferences(references);
  const kakao = readKakaoMenus(dirs, brands);
  const collected = collectMenuNameTargets(
    kakao.independentRows,
    kakao.categoryByPlaceId,
  );
  const selected = collected.targets.slice(0, limit);
  const mfdsFile = arg('mfds-file');
  const mfdsMenus = mfdsFile
    ? readMfdsFile(resolve(process.cwd(), mfdsFile))
    : await readMfdsFromDatabase();
  if (mfdsMenus.length === 0) {
    throw new Error(
      '식약처 음식 메뉴가 0개입니다. --mfds-file 또는 DB를 확인하세요.',
    );
  }
  const mfdsIndex = buildMfdsIndex(mfdsMenus);
  const done = readDoneKeys(outputPath);
  const pending = selected.filter((target) => !done.has(target.key));
  const mfdsTargets = pending.filter((target) => mfdsIndex.has(target.key));
  const llmTargets = pending.filter((target) => !mfdsIndex.has(target.key));

  const totalRows = collected.targets.reduce(
    (sum, target) => sum + target.rowCount,
    0,
  );
  const selectedRows = selected.reduce(
    (sum, target) => sum + target.rowCount,
    0,
  );
  const selectedMfds = selected.filter((target) => mfdsIndex.has(target.key));
  console.log('[MENU_NUTRITION_ESTIMATE] input', {
    folderCount: dirs.length,
    referenceMenuCount: references.length,
    brandCount: brands.length,
    mfdsMenuCount: mfdsMenus.length,
    independentPlaceCount: kakao.independentPlaceCount,
    brandPlaceCount: kakao.brandPlaceCount,
    independentMenuRowCount: collected.rowCount,
    emptyNameRowCount: collected.emptyNameRowCount,
    uniqueNameCount: collected.targets.length,
    selectedNameCount: selected.length,
    selectedRowShare: round(selectedRows / Math.max(totalRows, 1)),
    selectedMfdsNameCount: selectedMfds.length,
    selectedMfdsRowShare: round(
      selectedMfds.reduce((sum, target) => sum + target.rowCount, 0) /
        Math.max(totalRows, 1),
    ),
    alreadyDoneCount: selected.length - pending.length,
    pendingMfdsCount: mfdsTargets.length,
    pendingLlmCount: llmTargets.length,
    // 크기 표기를 지워 같은 이름으로 합친 행(#41 결정 6 측정용)
    sizeMarks: sizeMarkSummary(selected),
  });

  const index = new ReferenceIndex(references);
  if (dryRun) {
    console.log('[MENU_NUTRITION_ESTIMATE] dry-run estimate', {
      model,
      batchSize,
      concurrency,
      rpm,
      fallbackThreshold,
      referenceLimit,
      prices,
      ...estimateRun(llmTargets, index, {
        batchSize,
        concurrency,
        rpm,
        fallbackThreshold,
        prices,
        referenceLimit,
      }),
    });
    console.log(
      '[MENU_NUTRITION_ESTIMATE] top names',
      selected.slice(0, 20).map((target) => ({
        key: target.key,
        sampleName: target.sampleName,
        storeCount: target.storeCount,
        restaurantCategory: target.restaurantCategory,
        mfds: mfdsIndex.has(target.key),
      })),
    );
    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  const write = (record: EstimateRecord) =>
    appendFileSync(outputPath, `${JSON.stringify(record)}\n`, 'utf8');
  const now = new Date();
  for (const target of mfdsTargets) {
    write(mfdsRecord(target, mfdsIndex.get(target.key), now));
  }
  console.log('[MENU_NUTRITION_ESTIMATE] mfds written', {
    count: mfdsTargets.length,
  });
  if (llmTargets.length === 0) return;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY가 필요합니다.');
  }
  // 정한 모델 하나만 쓴다. HttpGeminiClient는 env로 모델 목록을 정하므로 fallback 모델 env를 비운다.
  process.env.GEMINI_MODEL = model;
  process.env.GEMINI_FALLBACK_MODELS = '';
  delete process.env.GEMINI_FALLBACK_MODEL;
  const client = new HttpGeminiClient(new HttpService());
  const startedAt = Date.now();
  let lastLogAt = 0;
  const estimator = new MenuNutritionEstimator<MenuNameTarget>({
    client,
    references: index,
    model,
    batchSize,
    concurrency,
    minRequestIntervalMs: Math.ceil(60_000 / rpm),
    maxRetries,
    retryBaseDelayMs: 2_000,
    fallbackThreshold,
    timeoutMs,
    onRecord: (record, target) =>
      write({
        ...record,
        storeCount: target.storeCount,
        rowCount: target.rowCount,
      }),
    onBatchDone: (stats) => {
      if (Date.now() - lastLogAt < 10_000) return;
      lastLogAt = Date.now();
      console.log('[MENU_NUTRITION_ESTIMATE] progress', {
        done: stats.doneCount,
        total: stats.targetCount,
        ok: stats.okCount,
        failed: stats.failedCount,
        requests: stats.requestCount,
        rateLimited: stats.rateLimitedCount,
        costUsd: round(
          costUsd(stats.inputTokens, stats.outputTokens, prices),
          3,
        ),
      });
    },
  });
  const stats = await estimator.run(llmTargets);
  console.log('[MENU_NUTRITION_ESTIMATE] completed', {
    ...stats,
    costUsd: round(costUsd(stats.inputTokens, stats.outputTokens, prices), 3),
    elapsedMinutes: round((Date.now() - startedAt) / 60_000, 1),
    outputPath,
  });
}

main().catch((error) => {
  console.error('[MENU_NUTRITION_ESTIMATE] failed', error);
  process.exitCode = 1;
});
