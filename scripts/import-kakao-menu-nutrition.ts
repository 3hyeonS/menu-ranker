import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import dataSource from '../src/config/typeorm.datasource';
import { MIN_DISPLAY_ESTIMATE_CONFIDENCE } from '../src/restaurant/branch-menu-estimate.constants';
import { RestaurantMenuNutritionEstimateEntity } from '../src/restaurant/entity/restaurant-menu-nutrition-estimate.entity';
import { BRANCH_MENU_NAME_MAX_LENGTH } from '../src/utils/branch-menu-name.util';
import { readJsonLines } from './crawl-common/crawl-files';
import {
  EstimateRecord,
  latestOkRecords,
  parseEstimateRecord,
} from './kakao-map/kakao-menu-nutrition';

// restaurant:menu-nutrition:estimate가 쓴 JSONL을 restaurant_menu_nutrition_estimate에 적재한다(#41).
// 같은 정규화 이름은 파일 뒤쪽(나중에 쓴) 성공 레코드가 이긴다. 실패 레코드는 넣지 않는다.
// normalized_name 기준 upsert라 같은 입력으로 다시 실행해도 결과가 같다. 입력에 없는 이름은 건드리지 않는다.

const ROW_CHUNK_SIZE = 1_000;
const SAMPLE_NAME_MAX_LENGTH = 255;

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function toRow(record: EstimateRecord) {
  return {
    normalizedName: record.normalizedName,
    sampleName: record.sampleName.slice(0, SAMPLE_NAME_MAX_LENGTH),
    source: record.source,
    calories: record.nutrition?.calories ?? null,
    carbs: record.nutrition?.carbs ?? null,
    protein: record.nutrition?.protein ?? null,
    fat: record.nutrition?.fat ?? null,
    sugars: record.nutrition?.sugars ?? null,
    satFat: record.nutrition?.satFat ?? null,
    unit: record.unit === 1 ? 1 : 0,
    weight: record.weight,
    unitQuantity: (record.unitQuantity || '인분').slice(0, 50),
    confidence: record.confidence,
    estimatePath: record.path,
    ragConfidence: record.ragConfidence,
    model: record.model,
    promptVersion: record.promptVersion,
    referenceMenus: record.references ?? null,
    inputTokens: record.inputTokens ?? null,
    outputTokens: record.outputTokens ?? null,
    estimatedAt: new Date(record.estimatedAt),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate-only');
  const paths = args
    .filter((value) => !value.startsWith('--'))
    .map((path) => resolve(process.cwd(), path));
  if (paths.length === 0) {
    throw new Error(
      '사용법: npm run restaurant:menu-nutrition:import -- kakao-map/nutrition-estimate/estimates.jsonl [--validate-only]',
    );
  }
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(`입력 파일이 없습니다: ${missing.join(', ')}`);
  }

  let lineCount = 0;
  let invalidLineCount = 0;
  const parsed: EstimateRecord[] = [];
  for (const path of paths) {
    for (const row of readJsonLines<unknown>(path)) {
      lineCount += 1;
      const record = parseEstimateRecord(row);
      if (
        !record ||
        record.normalizedName.length > BRANCH_MENU_NAME_MAX_LENGTH
      ) {
        invalidLineCount += 1;
        continue;
      }
      parsed.push(record);
    }
  }
  const { records, failedOnlyCount } = latestOkRecords(parsed);
  const bySource: Record<string, number> = {};
  const byPath: Record<string, number> = {};
  for (const record of records) {
    bySource[record.source] = (bySource[record.source] ?? 0) + 1;
    const path = record.path ?? record.source;
    byPath[path] = (byPath[path] ?? 0) + 1;
  }
  console.log('[MENU_NUTRITION_IMPORT] plan', {
    fileCount: paths.length,
    lineCount,
    invalidLineCount,
    recordCount: records.length,
    // 성공 레코드가 하나도 없어 적재하지 않는 이름(다음 추정 실행에서 다시 시도한다)
    failedOnlyCount,
    bySource,
    byPath,
    hiddenLowConfidenceCount: records.filter(
      (record) => (record.confidence ?? 0) < MIN_DISPLAY_ESTIMATE_CONFIDENCE,
    ).length,
    validateOnly,
  });
  if (validateOnly) return;

  await dataSource.initialize();
  try {
    let writtenCount = 0;
    for (const rows of chunks(records.map(toRow), ROW_CHUNK_SIZE)) {
      // manager.upsert()는 갱신만 일어나면 "entity id is not set" 오류가 나므로 QueryBuilder로 쓴다(#30 참고).
      await dataSource
        .createQueryBuilder()
        .insert()
        .into(RestaurantMenuNutritionEstimateEntity)
        .values(rows)
        .orUpdate(
          [
            'sample_name',
            'source',
            'calories',
            'carbs',
            'protein',
            'fat',
            'sugars',
            'sat_fat',
            'unit',
            'weight',
            'unit_quantity',
            'confidence',
            'estimate_path',
            'rag_confidence',
            'model',
            'prompt_version',
            'reference_menus',
            'input_tokens',
            'output_tokens',
            'estimated_at',
          ],
          ['normalized_name'],
        )
        .updateEntity(false)
        .execute();
      writtenCount += rows.length;
      console.log('[MENU_NUTRITION_IMPORT] progress', {
        writtenCount,
        total: records.length,
      });
    }
    console.log('[MENU_NUTRITION_IMPORT] completed', { writtenCount });
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[MENU_NUTRITION_IMPORT] failed', error);
    process.exitCode = 1;
  });
}
