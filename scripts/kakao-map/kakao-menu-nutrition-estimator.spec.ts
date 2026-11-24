import { FakeGeminiClient } from '../../src/gemini/fake-gemini.client';
import {
  EstimateRecord,
  ReferenceIndex,
  ReferenceMenu,
} from './kakao-menu-nutrition';
import {
  EstimatorOptions,
  EstimatorTarget,
  MenuNutritionEstimator,
} from './kakao-menu-nutrition-estimator';

function reference(id: number, name: string, brand = '한솥'): ReferenceMenu {
  return {
    id,
    name,
    brand,
    restaurantCategory: null,
    menuCategory: null,
    unit: 0,
    weight: 400,
    unitQuantity: '1인분',
    totalWeight: null,
    nutrition: {
      calories: 450,
      carbs: 30,
      protein: 20,
      fat: 15,
      sugars: 3,
      satFat: 5,
    },
  };
}

const references = new ReferenceIndex([
  reference(1, '김치찌개'),
  reference(2, '된장찌개'),
]);

function target(key: string, excludeBrand?: string): EstimatorTarget {
  return { key, sampleName: key, restaurantCategory: '한식', excludeBrand };
}

function item(id: string, calories: number, confidence: number) {
  return {
    id,
    calories,
    carbs: 30,
    protein: 20,
    fat: 15,
    sugars: 3,
    satFat: 5,
    weightG: 450,
    confidence,
  };
}

const usage = (prompt: number, candidates: number) => ({
  promptTokenCount: prompt,
  candidatesTokenCount: candidates,
  totalTokenCount: prompt + candidates,
});

function createEstimator(
  client: FakeGeminiClient,
  overrides: Partial<EstimatorOptions<EstimatorTarget>> = {},
) {
  const records: EstimateRecord[] = [];
  const sleep = jest.fn().mockResolvedValue(undefined);
  const estimator = new MenuNutritionEstimator<EstimatorTarget>({
    client,
    references,
    model: 'gemini-2.5-flash-lite',
    batchSize: 10,
    concurrency: 1,
    minRequestIntervalMs: 0,
    maxRetries: 2,
    retryBaseDelayMs: 1000,
    fallbackThreshold: 0.7,
    timeoutMs: 30_000,
    onRecord: (record) => {
      records.push(record);
    },
    sleep,
    random: () => 0.5,
    now: () => new Date('2026-11-24T00:00:00Z'),
    ...overrides,
  });
  return { estimator, records, sleep };
}

const promptOf = (client: FakeGeminiClient, index: number) =>
  (client.requests[index].contents[0].parts[0] as { text: string }).text;

describe('MenuNutritionEstimator', () => {
  it('keeps confident RAG estimates and splits batch tokens per menu', async () => {
    const client = new FakeGeminiClient('gemini-2.5-flash-lite').respondJson(
      [item('1', 480, 0.9), item('2', 420, 0.75)],
      usage(800, 200),
    );
    const { estimator, records } = createEstimator(client);

    const stats = await estimator.run([target('김치찌개'), target('된장찌개')]);

    expect(client.requests).toHaveLength(1);
    expect(promptOf(client, 0)).toContain('referenceMenus');
    expect(client.requests[0]).toMatchObject({
      modelGroup: 'text',
      // 정한 모델 하나만 쓴다(fallback 모델 없음).
      models: ['gemini-2.5-flash-lite'],
      timeoutMs: 30_000,
      generationConfig: { responseMimeType: 'application/json' },
    });
    expect(records).toEqual([
      expect.objectContaining({
        normalizedName: '김치찌개',
        status: 'ok',
        source: 'llm',
        path: 'rag',
        confidence: 0.9,
        ragConfidence: 0.9,
        unitQuantity: '인분',
        weight: 450,
        model: 'gemini-2.5-flash-lite',
        inputTokens: 400,
        outputTokens: 100,
        references: [
          { name: '김치찌개', brand: '한솥', score: 1 },
          // '찌개' bigram 하나만 겹친다: 1 / (3 + 3 - 1)
          { name: '된장찌개', brand: '한솥', score: 0.2 },
        ],
      }),
      expect.objectContaining({ normalizedName: '된장찌개', path: 'rag' }),
    ]);
    expect(stats).toMatchObject({
      okCount: 2,
      failedCount: 0,
      requestCount: 1,
      inputTokens: 800,
      outputTokens: 200,
      byPath: { rag: 2 },
    });
  });

  it('re-estimates low-confidence RAG results without references', async () => {
    const client = new FakeGeminiClient()
      .respondJson([item('1', 480, 0.9), item('2', 300, 0.5)], usage(800, 200))
      .respondJson([item('1', 410, 0.8)], usage(200, 100));
    const { estimator, records } = createEstimator(client);

    const stats = await estimator.run([target('김치찌개'), target('된장찌개')]);

    expect(client.requests).toHaveLength(2);
    expect(promptOf(client, 1)).not.toContain('referenceMenus');
    expect(promptOf(client, 1)).toContain('"name":"된장찌개"');
    expect(records[1]).toMatchObject({
      normalizedName: '된장찌개',
      path: 'llm_only',
      confidence: 0.8,
      ragConfidence: 0.5,
      references: [],
      inputTokens: 600,
      outputTokens: 200,
    });
    expect(stats.fallbackItemCount).toBe(1);
    expect(stats.byPath).toEqual({ rag: 1, llm_only: 1 });
  });

  it('keeps the RAG value when the re-estimate fails', async () => {
    const client = new FakeGeminiClient()
      .respondJson([item('1', 300, 0.5)])
      .failUnavailable()
      .failUnavailable()
      .failUnavailable();
    const { estimator, records } = createEstimator(client);

    await estimator.run([target('김치찌개')]);

    expect(records[0]).toMatchObject({
      status: 'ok',
      path: 'rag',
      confidence: 0.5,
      ragConfidence: 0.5,
    });
  });

  it('keeps a displayable RAG value over a re-estimate below the display threshold', async () => {
    const client = new FakeGeminiClient()
      .respondJson([item('1', 300, 0.65)])
      .respondJson([item('1', 900, 0.4)]);
    const { estimator, records } = createEstimator(client);

    await estimator.run([target('김치찌개')]);

    expect(records[0]).toMatchObject({
      path: 'rag',
      confidence: 0.65,
      ragConfidence: 0.65,
    });
  });

  it('does not re-estimate when the fallback threshold is 0', async () => {
    const client = new FakeGeminiClient().respondJson([item('1', 300, 0.3)]);
    const { estimator, records } = createEstimator(client, {
      fallbackThreshold: 0,
    });

    await estimator.run([target('김치찌개')]);

    expect(client.requests).toHaveLength(1);
    expect(records[0]).toMatchObject({ path: 'rag', confidence: 0.3 });
  });

  it('sends menus without any reference straight to the LLM-only prompt', async () => {
    const client = new FakeGeminiClient()
      .respondJson([item('1', 480, 0.9)])
      .respondJson([item('1', 5, 0.9)]);
    const { estimator, records } = createEstimator(client, {
      fallbackThreshold: 0,
    });

    await estimator.run([target('김치찌개'), target('아메리카노')]);

    expect(client.requests).toHaveLength(2);
    expect(promptOf(client, 0)).not.toContain('아메리카노');
    expect(promptOf(client, 1)).not.toContain('referenceMenus');
    expect(
      records.map((record) => [record.normalizedName, record.path]),
    ).toEqual([
      ['김치찌개', 'rag'],
      ['아메리카노', 'llm_only'],
    ]);
  });

  it('asks once more only for items with an invalid number format', async () => {
    const client = new FakeGeminiClient()
      .respondJson([item('1', 480, 0.9), { id: '2', calories: 'unknown' }])
      .respondJson([item('1', 420, 0.8)]);
    const { estimator, records } = createEstimator(client);

    const stats = await estimator.run([target('김치찌개'), target('된장찌개')]);

    expect(client.requests).toHaveLength(2);
    expect(promptOf(client, 1)).toContain('"menu":{"name":"된장찌개"');
    expect(promptOf(client, 1)).not.toContain('"menu":{"name":"김치찌개"');
    expect(records[1]).toMatchObject({ status: 'ok', confidence: 0.8 });
    expect(stats.formatRetryCount).toBe(1);
  });

  it('records a failure after the format retry also fails', async () => {
    const client = new FakeGeminiClient()
      .respondJson([{ id: '1', calories: null }])
      .respondJson([])
      .respondJson([])
      .respondJson([]);
    const { estimator, records } = createEstimator(client);

    const stats = await estimator.run([target('김치찌개')]);

    // RAG 2번(원 요청 + 형식 재시도) + 순수 LLM 2번
    expect(client.requests).toHaveLength(4);
    expect(records[0]).toMatchObject({
      status: 'failed',
      nutrition: null,
      path: null,
      error: 'missing or invalid response item',
    });
    expect(stats).toMatchObject({ okCount: 0, failedCount: 1 });
  });

  it('retries failed calls with exponential backoff', async () => {
    const client = new FakeGeminiClient()
      .failUnavailable()
      .failWith(new Error('timeout'))
      .respondJson([item('1', 480, 0.9)]);
    const { estimator, records, sleep } = createEstimator(client);

    const stats = await estimator.run([target('김치찌개')]);

    expect(records[0].status).toBe('ok');
    // random 0.5 → 지터 1배: 1000ms, 2000ms
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
    expect(stats).toMatchObject({ retryCount: 2, requestCount: 3 });
  });

  it('records failures and keeps going when every attempt fails', async () => {
    const client = new FakeGeminiClient()
      .failUnavailable()
      .failUnavailable()
      .failUnavailable()
      .failUnavailable()
      .failUnavailable()
      .failUnavailable()
      .respondJson([item('1', 420, 0.9)]);
    const { estimator, records } = createEstimator(client, { batchSize: 1 });

    await estimator.run([target('김치찌개'), target('된장찌개')]);

    expect(records[0]).toMatchObject({
      normalizedName: '김치찌개',
      status: 'failed',
    });
    expect(records[0].error).toContain('Gemini call failed after 3 attempts');
    expect(records[1]).toMatchObject({
      normalizedName: '된장찌개',
      status: 'ok',
    });
    expect(client.pendingResponseCount).toBe(0);
  });

  it('excludes the evaluated brand from references', async () => {
    const client = new FakeGeminiClient().respondJson([item('1', 5, 0.9)]);
    const { estimator, records } = createEstimator(client);

    await estimator.run([target('김치찌개', '한솥')]);

    // 한솥 메뉴를 빼면 근거가 없어 바로 순수 LLM으로 간다.
    expect(promptOf(client, 0)).not.toContain('referenceMenus');
    expect(records[0].path).toBe('llm_only');
  });

  it('spaces request starts by the minimum interval', async () => {
    const client = new FakeGeminiClient()
      .respondJson([item('1', 480, 0.9)])
      .respondJson([item('1', 420, 0.9)]);
    const { estimator, sleep } = createEstimator(client, {
      batchSize: 1,
      concurrency: 2,
      minRequestIntervalMs: 60_000,
    });

    await estimator.run([target('김치찌개'), target('된장찌개')]);

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0][0]).toBeGreaterThan(59_000);
  });
});
