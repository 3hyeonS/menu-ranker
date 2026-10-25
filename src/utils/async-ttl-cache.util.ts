// 비동기 loader 결과를 TTL 동안 메모리에 두는 단일 값 캐시.
// - 동시에 들어온 요청은 진행 중인 load 하나를 같이 기다린다.
// - loader가 실패하면 캐시하지 않고 오류를 그대로 던진다.
// - load 도중 invalidate()되면 그 결과는 저장하지 않는다.
// - TTL이 0 이하이면 캐시하지 않고 매번 load한다.
export class AsyncTtlCache<T> {
  private value: T | undefined;
  private expiresAt = 0;
  private pending: Promise<T> | null = null;
  private generation = 0;

  constructor(
    private readonly loader: () => Promise<T>,
    private readonly getTtlMs: () => number,
    private readonly now: () => number = Date.now,
  ) {}

  async get(): Promise<T> {
    const ttlMs = this.getTtlMs();

    if (ttlMs <= 0) {
      return await this.loader();
    }
    if (this.value !== undefined && this.now() < this.expiresAt) {
      return this.value;
    }
    if (this.pending) {
      return await this.pending;
    }

    const generation = this.generation;
    const pending = this.loader().then(
      (value) => {
        if (generation === this.generation) {
          this.value = value;
          this.expiresAt = this.now() + ttlMs;
          this.pending = null;
        }
        return value;
      },
      (error) => {
        if (generation === this.generation) {
          this.pending = null;
        }
        throw error;
      },
    );
    this.pending = pending;

    return await pending;
  }

  invalidate(): void {
    this.generation += 1;
    this.value = undefined;
    this.expiresAt = 0;
    this.pending = null;
  }
}
