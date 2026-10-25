import { isGramUnitText } from './nutrition-label.util';

describe('isGramUnitText', () => {
  it.each([
    'g',
    '100g',
    '100 g',
    '1회 제공량(30g)',
    '총 내용량 250g당',
    '그램',
  ])('recognizes %s as grams', (text) => {
    expect(isGramUnitText(text)).toBe(true);
  });

  it.each(['1kg', '나트륨 200mg', '비타민D 5μg', 'ml', 'kcal', ''])(
    'does not treat %s as grams',
    (text) => {
      expect(isGramUnitText(text)).toBe(false);
    },
  );
});
