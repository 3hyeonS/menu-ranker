import { canonicalizeMenuSearchName } from './menu-name.util';

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
