// 카카오 지점 메뉴명 → 영양 추정 키(#41). 영양 추정 테이블의 normalized_name과 지점 메뉴를 잇는 유일한 연결 고리라,
// 규칙을 바꾸면 이미 적재한 추정값과 지점 메뉴의 연결이 달라진다. 바꿀 때는 추정값을 다시 만들고 적재한다.
//
// #41 분석과 같은 규칙: 출처 접두어·괄호 안 옵션·수량 표기·단독 크기 표기를 지우고 한글·영문·숫자만 남긴다.
// 크기 표기((중)·(대)·2인분 등)를 지우는 것은 #41 결정 6(시범 결과로 다시 판단)에 따른 현재 규칙이다.

// Python 정규식의 유니코드 \b처럼 한글도 단어 문자로 본다(JS \b는 ASCII만 단어 문자로 본다).
const WORD_CHAR = '[\\p{L}\\p{N}_]';
const NOT_AFTER_WORD = `(?<!${WORD_CHAR})`;
const NOT_BEFORE_WORD = `(?!${WORD_CHAR})`;

const SOURCE_PREFIX_PATTERN = /^\(식약처_(?:음식|가공)\)\s*/u;
// 짝이 맞는 가장 짧은 괄호 구간. 여는·닫는 괄호 종류가 달라도 지운다(분석 규칙과 같음).
const BRACKET_PATTERN = /[([{].*?[)\]}]/gu;
const QUANTITY_PATTERN = new RegExp(
  `\\d+(?:\\.\\d+)?\\s*(?:g|kg|ml|l|인분|인|개|조각|pcs|p|피스|마리|판|잔|병|ea)${NOT_BEFORE_WORD}`,
  'giu',
);
const SIZE_PATTERN = new RegExp(
  `${NOT_AFTER_WORD}(?:소|중|대|특|s|m|l|r|hot|ice)${NOT_BEFORE_WORD}`,
  'giu',
);
const NON_KEY_CHAR_PATTERN = /[^0-9a-zA-Z가-힣]/gu;

export const BRANCH_MENU_NAME_MAX_LENGTH = 255;

export function normalizeBranchMenuName(menuName: string): string {
  return (menuName ?? '')
    .replace(SOURCE_PREFIX_PATTERN, '')
    .replace(BRACKET_PATTERN, '')
    .replace(QUANTITY_PATTERN, '')
    .replace(SIZE_PATTERN, '')
    .replace(NON_KEY_CHAR_PATTERN, '')
    .toLowerCase()
    .slice(0, BRANCH_MENU_NAME_MAX_LENGTH);
}
