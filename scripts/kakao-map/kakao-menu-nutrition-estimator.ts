// 카카오 지점 메뉴 영양 추정(#41)의 Gemini 호출부. 묶음 → RAG 추정 → (confidence 미만이면) 순수 LLM 재추정.
// GeminiClient 뒤에 있으므로 테스트는 FakeGeminiClient로 응답·오류를 주입한다.
import type {
  GeminiClient,
  GeminiJsonResult,
} from '../../src/gemini/gemini-client';
import {
  buildEstimatePrompt,
  EstimateMethod,
  EstimateRecord,
  EstimateValues,
  parseEstimateResponse,
  PromptItem,
  PROMPT_VERSION,
  ReferenceIndex,
  ReferenceMatch,
} from './kakao-menu-nutrition';

export interface EstimatorTarget {
  key: string;
  sampleName: string;
  restaurantCategory: string | null;
  /** 평가용: 이 브랜드의 공식 메뉴를 근거에서 뺀다(미관측 브랜드 흉내). */
  excludeBrand?: string;
}

export interface EstimatorOptions<T extends EstimatorTarget> {
  client: GeminiClient;
  references: ReferenceIndex;
  /** 결과 레코드에 남길 요청 모델(응답 모델을 모르면 이 값). */
  model: string;
  batchSize: number;
  concurrency: number;
  /** 요청 시작 사이 최소 간격(분당 요청 수 제한). 0이면 제한 없음. */
  minRequestIntervalMs: number;
  /** 호출 실패(429·5xx·타임아웃 등) 때 같은 묶음을 다시 보내는 횟수. */
  maxRetries: number;
  retryBaseDelayMs: number;
  /** RAG confidence가 이 값 미만이면 순수 LLM으로 다시 추정한다. 0이면 재추정하지 않는다. */
  fallbackThreshold: number;
  timeoutMs: number;
  /** RAG 근거 메뉴 수. 없으면 프로토콜 값(8). */
  referenceLimit?: number;
  onRecord: (record: EstimateRecord, target: T) => void | Promise<void>;
  onBatchDone?: (stats: EstimatorStats) => void;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => Date;
}

export interface EstimatorStats {
  targetCount: number;
  doneCount: number;
  okCount: number;
  failedCount: number;
  requestCount: number;
  /** 같은 요청을 다시 보낸 횟수(호출 실패) */
  retryCount: number;
  /** 숫자 형식이 틀린 항목만 모아 다시 물은 요청 수 */
  formatRetryCount: number;
  /** 순수 LLM 재추정 요청에 들어간 메뉴 수 */
  fallbackItemCount: number;
  rateLimitedCount: number;
  inputTokens: number;
  outputTokens: number;
  byPath: Record<string, number>;
}

interface CallOutcome {
  values: Map<string, EstimateValues>;
  model: string | null;
  error: string | null;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function httpStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } })?.response
    ?.status;
  return typeof status === 'number' ? status : null;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export class MenuNutritionEstimator<T extends EstimatorTarget> {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => Date;
  private nextRequestAt = 0;
  private readonly stats: EstimatorStats = {
    targetCount: 0,
    doneCount: 0,
    okCount: 0,
    failedCount: 0,
    requestCount: 0,
    retryCount: 0,
    formatRetryCount: 0,
    fallbackItemCount: 0,
    rateLimitedCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    byPath: {},
  };

  constructor(private readonly options: EstimatorOptions<T>) {
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => new Date());
  }

  async run(targets: readonly T[]): Promise<EstimatorStats> {
    this.stats.targetCount += targets.length;
    const queue = chunk(targets, this.options.batchSize);
    const workers = Array.from(
      { length: Math.max(1, Math.min(this.options.concurrency, queue.length)) },
      async () => {
        for (let batch = queue.shift(); batch; batch = queue.shift()) {
          await this.processBatch(batch);
          this.options.onBatchDone?.(this.snapshot());
        }
      },
    );
    await Promise.all(workers);
    return this.snapshot();
  }

  private snapshot(): EstimatorStats {
    return { ...this.stats, byPath: { ...this.stats.byPath } };
  }

  private async processBatch(batch: readonly T[]): Promise<void> {
    const references = new Map<string, ReferenceMatch[]>();
    const tokens = new Map<string, { input: number; output: number }>();
    batch.forEach((target) => {
      references.set(
        target.key,
        this.options.references.search(
          target.sampleName,
          target.restaurantCategory,
          {
            excludeBrand: target.excludeBrand,
            limit: this.options.referenceLimit,
          },
        ),
      );
      tokens.set(target.key, { input: 0, output: 0 });
    });

    // 근거 메뉴가 하나도 없으면 RAG 프롬프트가 순수 LLM과 같으므로 바로 순수 LLM으로 보낸다.
    const ragTargets = batch.filter(
      (target) => references.get(target.key).length > 0,
    );
    const rag =
      ragTargets.length > 0
        ? await this.estimateWithFormatRetry(
            'rag',
            ragTargets,
            references,
            tokens,
          )
        : {
            values: new Map<string, EstimateValues>(),
            model: null,
            error: null,
          };
    const threshold = this.options.fallbackThreshold;
    const needsFallback = batch.filter((target) => {
      if (references.get(target.key).length === 0) return true;
      return (
        threshold > 0 &&
        (rag.values.get(target.key)?.confidence ?? -1) < threshold
      );
    });
    this.stats.fallbackItemCount += needsFallback.length;
    const llmOnly =
      needsFallback.length > 0
        ? await this.estimateWithFormatRetry(
            'llm_only',
            needsFallback,
            references,
            tokens,
          )
        : null;

    for (const target of batch) {
      const ragValue = rag.values.get(target.key) ?? null;
      const llmValue = llmOnly?.values.get(target.key) ?? null;
      // 프로토콜: RAG confidence가 기준 이상이면 RAG, 아니면 순수 LLM. 재추정이 실패하면 RAG 값을 둔다.
      const path: EstimateMethod | null = llmValue
        ? 'llm_only'
        : ragValue
          ? 'rag'
          : null;
      const chosen = llmValue ?? ragValue;
      const tokenUse = tokens.get(target.key);
      const record: EstimateRecord = {
        normalizedName: target.key,
        sampleName: target.sampleName,
        status: chosen ? 'ok' : 'failed',
        source: 'llm',
        nutrition: chosen ? { ...chosen.nutrition } : null,
        unit: 0,
        weight: chosen?.weight ?? null,
        unitQuantity: '인분',
        confidence: chosen?.confidence ?? null,
        ragConfidence: ragValue?.confidence ?? null,
        path,
        model:
          (path === 'llm_only' ? llmOnly?.model : rag.model) ??
          this.options.model,
        promptVersion: PROMPT_VERSION,
        references:
          path === 'llm_only'
            ? []
            : (references.get(target.key) ?? []).map(({ menu, score }) => ({
                name: menu.name,
                brand: menu.brand,
                score: Math.round(score * 1000) / 1000,
              })),
        inputTokens: tokenUse.input,
        outputTokens: tokenUse.output,
        error: chosen
          ? null
          : (llmOnly?.error ?? rag.error ?? 'missing or invalid response item'),
        estimatedAt: this.now().toISOString(),
      };
      this.stats.doneCount += 1;
      if (chosen) {
        this.stats.okCount += 1;
        this.stats.byPath[path] = (this.stats.byPath[path] ?? 0) + 1;
      } else {
        this.stats.failedCount += 1;
      }
      await this.options.onRecord(record, target);
    }
  }

  /** 프로토콜: 숫자 형식이 틀린 항목은 한 번만 다시 묻는다. */
  private async estimateWithFormatRetry(
    method: EstimateMethod,
    targets: readonly T[],
    references: ReadonlyMap<string, ReferenceMatch[]>,
    tokens: Map<string, { input: number; output: number }>,
  ): Promise<CallOutcome> {
    const first = await this.call(method, targets, references, tokens);
    const missing = targets.filter((target) => !first.values.has(target.key));
    if (missing.length === 0 || first.error) {
      return first;
    }
    this.stats.formatRetryCount += 1;
    const second = await this.call(method, missing, references, tokens);
    return {
      values: new Map([...first.values, ...second.values]),
      model: first.model ?? second.model,
      error: second.error,
    };
  }

  private async call(
    method: EstimateMethod,
    targets: readonly T[],
    references: ReadonlyMap<string, ReferenceMatch[]>,
    tokens: Map<string, { input: number; output: number }>,
  ): Promise<CallOutcome> {
    const items: PromptItem[] = targets.map((target, index) => ({
      id: String(index + 1),
      name: target.sampleName,
      restaurantCategory: target.restaurantCategory,
      references: references.get(target.key),
    }));
    const prompt = buildEstimatePrompt(items, method);
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      if (attempt > 0) {
        this.stats.retryCount += 1;
        // 지수 백오프 + 지터(0.5~1.5배).
        await this.sleep(
          this.options.retryBaseDelayMs *
            2 ** (attempt - 1) *
            (0.5 + this.random()),
        );
      }
      await this.waitForRequestSlot();
      this.stats.requestCount += 1;
      let result: GeminiJsonResult<unknown>;
      try {
        result = await this.options.client.generateJsonWithUsage<unknown>({
          modelGroup: 'text',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
          timeoutMs: this.options.timeoutMs,
          unavailableMessage: 'Gemini menu nutrition estimate unavailable',
          onAttemptError: (error) => {
            if (httpStatus(error) === 429) this.stats.rateLimitedCount += 1;
          },
        });
      } catch (error) {
        lastError = error;
        continue;
      }

      const input = result.usage?.promptTokenCount ?? 0;
      const output = result.usage?.candidatesTokenCount ?? 0;
      this.stats.inputTokens += input;
      this.stats.outputTokens += output;
      for (const target of targets) {
        const use = tokens.get(target.key);
        use.input += Math.round(input / targets.length);
        use.output += Math.round(output / targets.length);
      }
      const parsed = parseEstimateResponse(
        result.value,
        items.map((item) => item.id),
      );
      const values = new Map<string, EstimateValues>();
      items.forEach((item, index) => {
        const value = parsed.get(item.id);
        if (value) values.set(targets[index].key, value);
      });
      return { values, model: result.model, error: null };
    }

    return {
      values: new Map(),
      model: null,
      error: `Gemini call failed after ${this.options.maxRetries + 1} attempts: ${errorMessage(lastError)}`,
    };
  }

  // 동시 요청이 여럿이어도 시작 시각이 minRequestIntervalMs 이상 벌어지게 순서대로 자리를 잡는다.
  private async waitForRequestSlot(): Promise<void> {
    const interval = this.options.minRequestIntervalMs;
    if (interval <= 0) return;
    const now = Date.now();
    const startAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = startAt + interval;
    if (startAt > now) {
      await this.sleep(startAt - now);
    }
  }
}
