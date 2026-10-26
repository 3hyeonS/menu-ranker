// chat의 normalizeComparableText와 같은 규칙(계란→달걀, 후라이→프라이)에 공백까지 지운다.
export const normalizeCompactFoodImageText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/계란/g, '달걀')
    .replace(/후라이/g, '프라이')
    .replace(/[^\w가-힣\s]/g, ' ')
    .replace(/\s+/g, '');

export const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0])
        : NaN;

  return Number.isFinite(parsed) ? parsed : null;
};
