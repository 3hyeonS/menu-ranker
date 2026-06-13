export const stripPublicMenuSourcePrefix = (menuName: string): string =>
  menuName
    .replace(/^\s*\((?:식약처_음식|식약처_가공)\)\s*/g, '')
    .trim();
