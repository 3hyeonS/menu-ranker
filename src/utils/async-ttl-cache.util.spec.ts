import { AsyncTtlCache } from './async-ttl-cache.util';

const deferred = <T>() => {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('AsyncTtlCache', () => {
  let now: number;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000;
  });

  it('reuses the loaded value until the TTL expires', async () => {
    let count = 0;
    const cache = new AsyncTtlCache(
      async () => ++count,
      () => 100,
      clock,
    );

    await expect(cache.get()).resolves.toBe(1);
    now += 99;
    await expect(cache.get()).resolves.toBe(1);
    now += 1;
    await expect(cache.get()).resolves.toBe(2);
  });

  it('shares one in-flight load between concurrent callers', async () => {
    const load = deferred<string>();
    const loader = jest.fn(() => load.promise);
    const cache = new AsyncTtlCache(loader, () => 100, clock);

    const first = cache.get();
    const second = cache.get();
    load.resolve('menus');

    await expect(Promise.all([first, second])).resolves.toEqual([
      'menus',
      'menus',
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed load', async () => {
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('menus');
    const cache = new AsyncTtlCache(loader, () => 100, clock);

    await expect(cache.get()).rejects.toThrow('db down');
    await expect(cache.get()).resolves.toBe('menus');
  });

  it('reloads after invalidate and drops a load that started before it', async () => {
    const stale = deferred<string>();
    const loader = jest
      .fn()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce('fresh')
      .mockResolvedValueOnce('unexpected');
    const cache = new AsyncTtlCache(loader, () => 100, clock);

    const staleResult = cache.get();
    cache.invalidate();
    const freshResult = cache.get();
    stale.resolve('stale');

    await expect(staleResult).resolves.toBe('stale');
    await expect(freshResult).resolves.toBe('fresh');
    await expect(cache.get()).resolves.toBe('fresh');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('loads every time when the TTL is 0', async () => {
    let count = 0;
    const cache = new AsyncTtlCache(
      async () => ++count,
      () => 0,
      clock,
    );

    await cache.get();
    await cache.get();

    expect(count).toBe(2);
  });
});
