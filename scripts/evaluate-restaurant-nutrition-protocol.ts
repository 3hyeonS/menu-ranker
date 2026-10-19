import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

type Method = 'llm_only' | 'hybrid_rag';
type Split = 'known_brand' | 'unseen_brand';
type Nutrient = 'calories' | 'carbs' | 'protein' | 'fat';
type Estimate = Record<Nutrient, number> & { confidence: number };
type Row = {
  split: Split;
  method: Method;
  menuId: string;
  truth: Record<Nutrient, number | null>;
  estimate: Estimate | null;
};

const nutrients: Nutrient[] = ['calories', 'carbs', 'protein', 'fat'];

function score(id: string): number {
  return createHash('sha256')
    .update(`restaurant-protocol-calibration:${id}`)
    .digest()
    .readUInt32BE(0) / 0xffffffff;
}

function summarize(rows: Row[]): Record<string, unknown> {
  const successful = rows.filter((row) => row.estimate);
  return {
    requested: rows.length,
    coverage: successful.length / Math.max(rows.length, 1),
    meanConfidence:
      successful.reduce((sum, row) => sum + row.estimate!.confidence, 0) /
      Math.max(successful.length, 1),
    nutrients: Object.fromEntries(
      nutrients.map((nutrient) => {
        const pairs = successful
          .filter((row) => row.truth[nutrient] != null)
          .map((row) => ({
            truth: row.truth[nutrient]!,
            estimate: row.estimate![nutrient],
          }));
        const errors = pairs.map((pair) => Math.abs(pair.estimate - pair.truth));
        const relative = pairs
          .filter((pair) => pair.truth > 0)
          .map((pair) => Math.abs(pair.estimate - pair.truth) / pair.truth);
        return [nutrient, {
          evaluated: pairs.length,
          mae: errors.length
            ? errors.reduce((sum, value) => sum + value, 0) / errors.length
            : null,
          within20Percent: relative.length
            ? relative.filter((value) => value <= 0.2).length / relative.length
            : null,
          within30Percent: relative.length
            ? relative.filter((value) => value <= 0.3).length / relative.length
            : null,
        }];
      }),
    ),
  };
}

function selectPolicyRows(
  ids: string[],
  byKey: Map<string, Row>,
  threshold: number,
  abstainBelow: number | null,
): Row[] {
  return ids.map((id) => {
    const llm = byKey.get(`unseen_brand:llm_only:${id}`)!;
    const rag = byKey.get(`unseen_brand:hybrid_rag:${id}`)!;
    const selected =
      rag.estimate && rag.estimate.confidence >= threshold ? rag : llm;
    if (
      abstainBelow != null &&
      (!selected.estimate || selected.estimate.confidence < abstainBelow)
    ) {
      return { ...selected, estimate: null };
    }
    return selected;
  });
}

function main(): void {
  const inputPath = resolve(
    process.argv.find((arg) => arg.startsWith('--input='))?.slice(8) ??
      'benchmark-results/restaurant-nutrition-llm.json',
  );
  const outputPath = resolve(
    process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
      'benchmark-results/restaurant-nutrition-protocol.json',
  );
  const input = JSON.parse(readFileSync(inputPath, 'utf8')) as {
    predictions: Row[];
  };
  const rows = input.predictions;
  const byKey = new Map(
    rows.map((row) => [`${row.split}:${row.method}:${row.menuId}`, row]),
  );
  const unseenIds = [
    ...new Set(
      rows
        .filter((row) => row.split === 'unseen_brand')
        .map((row) => row.menuId),
    ),
  ];
  const calibrationIds = unseenIds.filter((id) => score(id) < 0.5);
  const evaluationIds = unseenIds.filter((id) => score(id) >= 0.5);
  const thresholds = [0.5, 0.6, 0.7, 0.8, 0.9];
  const calibration = thresholds.map((threshold) => {
    const selected = selectPolicyRows(calibrationIds, byKey, threshold, null);
    return { threshold, summary: summarize(selected) };
  });
  const best = [...calibration].sort((left, right) => {
    const leftMae = (left.summary.nutrients as any).calories.mae ?? Infinity;
    const rightMae = (right.summary.nutrients as any).calories.mae ?? Infinity;
    return leftMae - rightMae;
  })[0];
  const evaluation = selectPolicyRows(
    evaluationIds,
    byKey,
    best.threshold,
    null,
  );
  const evaluationWithAbstention = selectPolicyRows(
    evaluationIds,
    byKey,
    best.threshold,
    0.6,
  );
  const knownRag = rows.filter(
    (row) => row.split === 'known_brand' && row.method === 'hybrid_rag',
  );
  const output = {
    generatedAt: new Date().toISOString(),
    protocol: {
      knownBrand: 'hybrid_rag',
      unseenBrand: `hybrid_rag when RAG confidence >= ${best.threshold}; otherwise llm_only`,
      optionalAbstention: 'abstain when selected estimate confidence < 0.6',
    },
    sample: {
      knownBrand: knownRag.length,
      unseenCalibration: calibrationIds.length,
      unseenEvaluation: evaluationIds.length,
    },
    calibration,
    results: {
      knownBrand: summarize(knownRag),
      unseenBrandEvaluation: summarize(evaluation),
      unseenBrandEvaluationWithAbstention: summarize(evaluationWithAbstention),
      unseenLlmOnlyEvaluation: summarize(
        evaluationIds.map((id) => byKey.get(`unseen_brand:llm_only:${id}`)!),
      ),
      unseenRagOnlyEvaluation: summarize(
        evaluationIds.map((id) => byKey.get(`unseen_brand:hybrid_rag:${id}`)!),
      ),
    },
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log('[NUTRITION_PROTOCOL] completed', {
    outputPath,
    selectedThreshold: best.threshold,
    calibrationSize: calibrationIds.length,
    evaluationSize: evaluationIds.length,
  });
}

main();
