import { normalizeBranchMenuName } from './branch-menu-name.util';

describe('normalizeBranchMenuName', () => {
  it.each([
    ['김치찌개', '김치찌개'],
    ['김치 찌개', '김치찌개'],
    ['물냉면(대)', '물냉면'],
    ['[점심특선] 제육볶음', '제육볶음'],
    ['삼겹살 2인분', '삼겹살'],
    ['생맥주 500ml', '생맥주'],
    ['군만두 8개', '군만두'],
    ['족발 소', '족발'],
    ['아메리카노 ICE', '아메리카노'],
    ['ICE 아메리카노', '아메리카노'],
    ['BLT 샌드위치', 'blt샌드위치'],
    ['(식약처_음식) 가래떡', '가래떡'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBranchMenuName(input)).toBe(expected);
  });

  it('keeps size words that are part of a longer word', () => {
    // 한글도 단어 문자로 본다: '소고기'의 '소', '중국'의 '중'은 크기 표기가 아니다.
    expect(normalizeBranchMenuName('소고기국밥')).toBe('소고기국밥');
    expect(normalizeBranchMenuName('중국냉면')).toBe('중국냉면');
    expect(normalizeBranchMenuName('대패삼겹살')).toBe('대패삼겹살');
  });

  it('keeps counts that are part of a set name', () => {
    expect(normalizeBranchMenuName('2인세트')).toBe('2인세트');
    expect(normalizeBranchMenuName('1인분세트')).toBe('1인분세트');
  });

  it('returns an empty key for symbol-only names', () => {
    expect(normalizeBranchMenuName('★★★')).toBe('');
    expect(normalizeBranchMenuName('(대)')).toBe('');
  });

  it('truncates to the column length', () => {
    expect(normalizeBranchMenuName('가'.repeat(300))).toHaveLength(255);
  });
});
