import {
  canonicalizeMenuSearchName,
  isGenericSweetPotatoCandidateCompatible,
  isGenericSweetPotatoName,
  isGenericPlainSaltName,
  isPreferredGenericRefinedSaltMenu,
  isPreferredGenericSweetPotatoMenu,
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

describe('generic sweet potato matching', () => {
  it.each(['고구마', '찐고구마', '삶은 고구마', '군고구마'])(
    'recognizes %s as a generic sweet potato',
    (name) => {
      expect(isGenericSweetPotatoName(name)).toBe(true);
    },
  );

  it.each(['고구마미음', '고구마밥', '고구마피자'])(
    'does not treat %s as a generic sweet potato',
    (name) => {
      expect(isGenericSweetPotatoName(name)).toBe(false);
    },
  );

  it('prioritizes the public steamed sweet potato menu', () => {
    const candidates = [
      { id: 37047, name: '(식약처_가공) 고구마미음' },
      { id: 1929, name: '(식약처_음식) 찐고구마' },
      { id: 1932, name: '(식약처_음식) 고구마밥' },
    ];

    expect(
      prioritizeGenericFoodImageCandidate('고구마', candidates)[0].id,
    ).toBe(1929);
    expect(
      isPreferredGenericSweetPotatoMenu('고구마', candidates[1].name),
    ).toBe(true);
  });

  it('rejects sweet potato porridge for a generic sweet potato recognition', () => {
    expect(
      isGenericSweetPotatoCandidateCompatible(
        '고구마',
        '(식약처_가공) 고구마미음',
      ),
    ).toBe(false);
    expect(
      isGenericSweetPotatoCandidateCompatible(
        '고구마미음',
        '(식약처_가공) 고구마미음',
      ),
    ).toBe(true);
  });
});
