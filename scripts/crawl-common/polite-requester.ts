// 크롤러 공용 HTTP 요청기: 요청마다 지연(+지터), 재시도, 지수 백오프, 연속 차단 시 중단.
// 네이버(#26)·카카오(#28) 수집 스크립트가 함께 쓴다.

export interface HttpResponse {
  status: number;
  body: string;
}

/** 실제 구현은 fetch, 테스트는 픽스처를 돌려주는 Fake를 쓴다. */
export interface HttpFetcher {
  get(url: string, headers?: Record<string, string>): Promise<HttpResponse>;
}

export interface RequestPolicy {
  minDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
  backoffBaseMs: number;
  /** 연속으로 이만큼 차단(재시도 소진)되면 멈춘다. */
  maxConsecutiveBlocks: number;
}

export interface RequesterDeps {
  fetcher: HttpFetcher;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  log: (message: string) => void;
}

export class BlockedError extends Error {}

export const DEFAULT_RETRYABLE_STATUS = new Set([403, 429, 500, 502, 503, 504]);

export class PoliteRequester {
  private consecutiveBlocks = 0;
  private stoppedFlag = false;

  constructor(
    private readonly policy: RequestPolicy,
    private readonly deps: RequesterDeps,
    /** 차단·일시 오류로 보고 재시도할 응답인지. */
    private readonly isRetryable: (response: HttpResponse) => boolean = (
      response,
    ) => DEFAULT_RETRYABLE_STATUS.has(response.status),
  ) {}

  /** 연속 차단 상한에 닿아 더 요청하지 않는 상태. */
  get stopped(): boolean {
    return this.stoppedFlag;
  }

  /**
   * 지연·재시도·백오프를 적용한 GET. 정상(200)이나 재시도하지 않는 상태(404 등)는 응답을,
   * 재시도를 소진했거나 멈춘 상태면 null을 돌려준다.
   */
  async get(
    url: string,
    headers?: Record<string, string>,
  ): Promise<HttpResponse | null> {
    for (let attempt = 0; attempt <= this.policy.maxRetries; attempt += 1) {
      if (this.stoppedFlag) return null;
      await this.deps.sleep(this.politeDelay());
      let response: HttpResponse;
      try {
        response = await this.deps.fetcher.get(url, headers);
      } catch (error) {
        this.deps.log(
          `  요청 오류(${attempt + 1}회): ${(error as Error).message} ${url}`,
        );
        if (attempt < this.policy.maxRetries)
          await this.deps.sleep(this.backoff(attempt));
        continue;
      }
      const blocked = this.isRetryable(response);
      if (response.status === 200 && !blocked) {
        this.consecutiveBlocks = 0;
        return response;
      }
      if (!blocked) {
        this.deps.log(`  HTTP ${response.status}, 건너뜀: ${url}`);
        return response;
      }
      this.deps.log(
        `  차단/오류 응답 ${response.status}(${attempt + 1}회): ${url}`,
      );
      if (attempt < this.policy.maxRetries)
        await this.deps.sleep(this.backoff(attempt));
    }
    this.consecutiveBlocks += 1;
    if (this.consecutiveBlocks >= this.policy.maxConsecutiveBlocks)
      this.stoppedFlag = true;
    return null;
  }

  private politeDelay(): number {
    const { minDelayMs, maxDelayMs } = this.policy;
    return (
      minDelayMs + this.deps.random() * Math.max(0, maxDelayMs - minDelayMs)
    );
  }

  private backoff(attempt: number): number {
    const base = this.policy.backoffBaseMs * 2 ** attempt;
    return base + this.deps.random() * base * 0.5;
  }
}
