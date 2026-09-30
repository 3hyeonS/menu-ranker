import {
  canonicalizeMenuSearchName,
  isGenericPlainSaltName,
  isPreferredGenericRefinedSaltMenu,
  prioritizeGenericFoodImageCandidate,
} from './menu-name.util';

describe('canonicalizeMenuSearchName', () => {
  it.each([
    ['만두국', '만둣국'],
    ['초콜렛', '초콜릿'],
    ['브라보', '부라보'],
    ['장아찌', '짱아찌'],
  ])('%s과(와) %s을 같은 검색어로 정규화한다', (left, right) => {
    expect(canonicalizeMenuSearchName(left)).toBe(
      canonicalizeMenuSearchName(right),
    );
  });

  it('메뉴명에 포함된 표기 차이도 정규화한다', () => {
    expect(canonicalizeMenuSearchName('브라보콘 초콜렛')).toBe(
      canonicalizeMenuSearchName('부라보콘 초콜릿'),
    );
  });
});

describe('generic refined salt matching', () => {
  it.each([
    '소금',
    '정제염',
    '식염',
    '소금장',
    '소금 양념장',
    '찍어 먹는 소금',
  ])('recognizes %s as generic plain salt', (name) => {
    expect(isGenericPlainSaltName(name)).toBe(true);
  });

  it.each(['맛소금', '죽염', '트러플소금', '소금빵'])(
    'does not treat %s as generic plain salt',
    (name) => {
      expect(isGenericPlainSaltName(name)).toBe(false);
    },
  );

  it('prioritizes menu 219056 for a generic salt recognition', () => {
    const candidates = [
      { id: 100023, name: '(식약처_가공) 맛소금(정제염)' },
      { id: 219056, name: '(식약처_가공) 정제염' },
    ];

    expect(prioritizeGenericFoodImageCandidate('소금', candidates)[0].id).toBe(
      219056,
    );
    expect(isPreferredGenericRefinedSaltMenu('소금', candidates[1])).toBe(true);
  });
});
