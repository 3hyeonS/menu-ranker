import { KeyedTtlCache } from './keyed-ttl-cache.util';

describe('KeyedTtlCache', () => {
  it('returns a value until the TTL expires', () => {
    let now = 1000;
    const cache = new KeyedTtlCache<number>(100, 10, () => now);

    cache.set('a', 1);
    now = 1099;
    expect(cache.get('a')).toBe(1);

    now = 1100;
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts the oldest entry when maxEntries is exceeded', () => {
    const cache = new KeyedTtlCache<number>(100, 2, () => 0);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 3);
    cache.set('c', 4);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(3);
    expect(cache.get('c')).toBe(4);
  });
});
