import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { performance } from 'perf_hooks';
import 'dotenv/config';

// sharp 0.35 is callable at runtime, while its current declaration is namespace-shaped.
const sharp: any = require('sharp');

type Nutrients = { calories: number; carbs: number; protein: number; fat: number };
type Item = {
  item_id: string;
  menu_name: string;
  image_path: string;
  calories_kcal: number;
  carbohydrate_g: number;
  protein_g: number;
  fat_g: number;
};
type Estimate = Nutrients & { confidence: number };
type Result = {
  id: string;
  condition: 'name_only' | 'name_photo';
  truth: Nutrients;
  estimate: Estimate | null;
  latencyMs: number;
  usage: Record<string, number>;
  error: string | null;
};

const args = process.argv.slice(2);
const arg = (name: string, fallback: string): string =>
  args.find((value) => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const root = resolve(arg('dataset', 'benchmark-inputs/public/foodbd'));
const output = resolve(arg('output', 'benchmark-results/foodbd-photo-effect.json'));
const checkpoint = resolve(arg('checkpoint', 'benchmark-results/cache/foodbd-photo-effect.json'));
const limit = Number(arg('limit', '100'));
const batchSize = Number(arg('batch-size', '5'));
const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
const apiKey = process.env.GEMINI_API_KEY;

function stableSample(items: Item[]): Item[] {
  return [...items]
    .sort((a, b) =>
      createHash('sha256').update(`foodbd-photo-v1:${a.item_id}`).digest('hex')
        .localeCompare(createHash('sha256').update(`foodbd-photo-v1:${b.item_id}`).digest('hex')),
    )
    .slice(0, limit);
}

function prompt(items: Item[]): string {
  return `각 음식 사진 한 장에 담긴 전체 식사의 영양성분을 추정해.
입력에는 메뉴 구성명${items.length > 0 ? '' : ''}만 제공되며 실제 영양정보·중량·브랜드·카테고리는 숨겨져 있어.
calories(kcal), carbs(g), protein(g), fat(g)을 0 이상의 숫자로 반환하고 confidence는 0~1로 반환해.
사진이 있으면 음식 종류와 양의 시각적 단서를 사용하되 보이지 않는 중량을 확정적으로 가정하지 마.
설명 없이 입력 순서와 id를 보존한 JSON 배열만 반환해.
형식: [{"id":"...","calories":0,"carbs":0,"protein":0,"fat":0,"confidence":0}]`;
}

async function imagePart(path: string): Promise<Record<string, unknown>> {
  const bytes = await sharp(path).resize({ width: 768, height: 768, fit: 'inside' }).jpeg({ quality: 82 }).toBuffer();
  return { inlineData: { mimeType: 'image/jpeg', data: bytes.toString('base64') } };
}

async function request(items: Item[], condition: Result['condition']): Promise<{ values: Estimate[] & Array<{ id: string }>; latencyMs: number; usage: Record<string, number> }> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt(items) }];
  for (const item of items) {
    parts.push({ text: `id=${item.item_id}\n메뉴 구성명=${item.menu_name}` });
    if (condition === 'name_photo') parts.push(await imagePart(join(root, item.image_path)));
  }
  const started = performance.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
  });
  const body = (await response.json()) as any;
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${JSON.stringify(body)}`);
  const text = body.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? '').join('');
  if (!text) throw new Error('Gemini returned empty content');
  return { values: JSON.parse(text), latencyMs: performance.now() - started, usage: body.usageMetadata ?? {} };
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

function summary(rows: Result[], pairedOnly = false): Record<string, unknown> {
  const pairedIds = new Set(
    rows
      .filter((row) => row.estimate)
      .map((row) => row.id)
      .filter((id) =>
        rows.some((row) => row.id === id && row.condition === 'name_only' && row.estimate) &&
        rows.some((row) => row.id === id && row.condition === 'name_photo' && row.estimate),
      ),
  );
  return Object.fromEntries((['name_only', 'name_photo'] as const).map((condition) => {
    const selected = rows.filter(
      (row) => row.condition === condition && (!pairedOnly || pairedIds.has(row.id)),
    );
    const ok = selected.filter((row) => row.estimate);
    const nutrients = Object.fromEntries((['calories', 'carbs', 'protein', 'fat'] as const).map((key) => {
      const errors = ok.map((row) => Math.abs(row.estimate![key] - row.truth[key]));
      const relative = ok.filter((row) => row.truth[key] > 0).map((row) => Math.abs(row.estimate![key] - row.truth[key]) / row.truth[key]);
      return [key, { mae: errors.reduce((a, b) => a + b, 0) / Math.max(errors.length, 1), within20Percent: relative.filter((x) => x <= 0.2).length / Math.max(relative.length, 1), within30Percent: relative.filter((x) => x <= 0.3).length / Math.max(relative.length, 1) }];
    }));
    const latencies = ok.map((row) => row.latencyMs);
    return [condition, { requested: selected.length, successful: ok.length, failureRate: 1 - ok.length / Math.max(selected.length, 1), latencyMs: { mean: latencies.reduce((a, b) => a + b, 0) / Math.max(latencies.length, 1), p95: percentile(latencies, 0.95) }, nutrients }];
  }));
}

async function main(): Promise<void> {
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  const items = stableSample(JSON.parse(await readFile(join(root, 'benchmark-manifest.json'), 'utf8')) as Item[]);
  await mkdir(dirname(checkpoint), { recursive: true });
  const rows: Result[] = existsSync(checkpoint) ? JSON.parse(await readFile(checkpoint, 'utf8')) : [];
  const completed = new Set(
    rows.filter((row) => row.estimate).map((row) => `${row.condition}:${row.id}`),
  );
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (!rows[index].estimate) rows.splice(index, 1);
  }
  for (const condition of ['name_only', 'name_photo'] as const) {
    for (let offset = 0; offset < items.length; offset += batchSize) {
      const batch = items.slice(offset, offset + batchSize).filter((item) => !completed.has(`${condition}:${item.item_id}`));
      if (!batch.length) continue;
      try {
        const response = await request(batch, condition);
        const byId = new Map(response.values.map((value: any) => [value.id, value]));
        for (const item of batch) {
          const value = byId.get(item.item_id) as Estimate | undefined;
          const valid = value && ['calories', 'carbs', 'protein', 'fat', 'confidence'].every((key) => Number.isFinite(Number((value as any)[key])));
          rows.push({ id: item.item_id, condition, truth: { calories: item.calories_kcal, carbs: item.carbohydrate_g, protein: item.protein_g, fat: item.fat_g }, estimate: valid ? Object.fromEntries(Object.entries(value!).map(([k, v]) => [k, k === 'id' ? v : Number(v)])) as Estimate : null, latencyMs: response.latencyMs / batch.length, usage: response.usage, error: valid ? null : 'missing or invalid response' });
        }
      } catch (error) {
        for (const item of batch) rows.push({ id: item.item_id, condition, truth: { calories: item.calories_kcal, carbs: item.carbohydrate_g, protein: item.protein_g, fat: item.fat_g }, estimate: null, latencyMs: 0, usage: {}, error: String(error) });
      }
      await writeFile(checkpoint, `${JSON.stringify(rows, null, 2)}\n`);
      console.log(`${condition}: ${Math.min(offset + batchSize, items.length)}/${items.length}`);
    }
  }
  await mkdir(dirname(output), { recursive: true });
  const allSummary = summary(rows);
  const pairedSummary = summary(rows, true);
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), model, sampleSize: items.length, inputPolicy: ['menu_name', 'photo (name_photo only)'], excludedInputs: ['brand', 'category', 'weight', 'ground-truth nutrition'], summary: allSummary, pairedSummary, rows }, null, 2)}\n`);
  console.log(JSON.stringify({ summary: allSummary, pairedSummary }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
