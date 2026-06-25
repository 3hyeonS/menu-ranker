export const stripPublicMenuSourcePrefix = (menuName: string): string =>
  menuName.replace(/^\s*\((?:식약처_음식|식약처_가공)\)\s*/g, '').trim();

const MENU_SEARCH_CANONICAL_REPLACERS: Array<[RegExp, string]> = [
  [/계란/g, '달걀'],
  [/후라이/g, '프라이'],
  [/소세지/g, '소시지'],
  [/쥬스/g, '주스'],
  [/돈까스/g, '돈가스'],
];

export const normalizeMenuSearchName = (menuName: string): string =>
  stripPublicMenuSourcePrefix(menuName ?? '')
    .toLowerCase()
    .replace(/[^\w가-힣]/g, '')
    .trim();

export const canonicalizeMenuSearchName = (menuName: string): string => {
  let normalized = normalizeMenuSearchName(menuName);

  MENU_SEARCH_CANONICAL_REPLACERS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized;
};
