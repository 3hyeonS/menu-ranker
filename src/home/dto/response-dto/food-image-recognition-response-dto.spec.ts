import { FoodImageRecognitionResponseDto } from './food-image-recognition-response-dto';

describe('FoodImageRecognitionResponseDto', () => {
  it('strips source prefixes from photo results while preserving IDs, amounts and input', () => {
    const input = {
      menu_ids: [13359, 219056, 300000],
      menu_names: [
        '(식약처_음식) 슈크림빵',
        '(식약처_가공) 정제염',
        '직접 만든 빵(슈크림)',
      ],
      menu_quantities: [40, 2, 100],
      image_url: 'https://example.com/meal.jpg',
    };

    expect(new FoodImageRecognitionResponseDto(input)).toEqual({
      ...input,
      menu_names: ['슈크림빵', '정제염', '직접 만든 빵(슈크림)'],
    });
    expect(input.menu_names[0]).toBe('(식약처_음식) 슈크림빵');
  });

  it('accepts empty recognition results', () => {
    expect(
      new FoodImageRecognitionResponseDto({
        menu_ids: [],
        menu_names: [],
        menu_quantities: [],
        image_url: '',
      }).menu_names,
    ).toEqual([]);
  });
});
