import {
  calculateFoodImageCandidateScore,
  FOOD_IMAGE_CORE_DETECTION_PROMPT_RULES,
  FOOD_IMAGE_DISH_GROUPING_PROMPT_RULES,
  FOOD_IMAGE_STRICT_DISH_TYPE_TOKENS,
  isFoodImageBrandMatch,
  isFoodImageSummaryMenuMatch,
} from './food-image-recognition.util';

describe('food image recognition prompt rules', () => {
  it('keeps a one-bowl bibimbap as one completed dish', () => {
    expect(FOOD_IMAGE_DISH_GROUPING_PROMPT_RULES).toContain(
      '비빔밥은 "비빔밥" 하나로 반환',
    );
    expect(FOOD_IMAGE_DISH_GROUPING_PROMPT_RULES).toContain(
      '재료별로 쪼개지 말고 완성 음식 하나로 반환',
    );
  });

  it('separates only independently served dishes and products', () => {
    expect(FOOD_IMAGE_DISH_GROUPING_PROMPT_RULES).toContain(
      '완성 요리와 별도로 담긴 국, 음료, 포장 제품, 반찬, 소스',
    );
  });

  it('shares product, grouping, quantity, and omission rules across flows', () => {
    expect(FOOD_IMAGE_CORE_DETECTION_PROMPT_RULES).toContain(
      'DB 후보를 의식하지 말고',
    );
    expect(FOOD_IMAGE_CORE_DETECTION_PROMPT_RULES).toContain(
      '비빔밥은 "비빔밥" 하나로 반환',
    );
    expect(FOOD_IMAGE_CORE_DETECTION_PROMPT_RULES).toContain(
      'detected_foods에도 포함해 누락되지 않게',
    );
    expect(FOOD_IMAGE_CORE_DETECTION_PROMPT_RULES).toContain(
      'estimated_quantity',
    );
  });
});

describe('food image candidate safeguards', () => {
  it('ranks the same-brand iced cafe latte above unrelated drinks', () => {
    const cafeLatteScore = calculateFoodImageCandidateScore(
      '아이스 카페라떼',
      {
        name: '(식약처_가공) 카페 라떼 아이스(ICED) (Tall) 커피',
        brand: '스타벅스',
        category: '커피류',
      },
      '스타벅스',
      null,
    );
    const unrelatedDrinkScore = calculateFoodImageCandidateScore(
      '아이스 카페라떼',
      {
        name: '기운내라임 병음료',
        brand: '스타벅스',
        category: '음료류',
      },
      '스타벅스',
      null,
    );

    expect(cafeLatteScore).toBeGreaterThan(unrelatedDrinkScore);
  });

  it('does not confuse BHC with the legal suffix GMBH & CO', () => {
    expect(
      isFoodImageBrandMatch(
        'BHC',
        'BRAUEREI SCHLOSS EGGENBERG STOHR GMBH & CO KG',
      ),
    ).toBe(false);
    expect(isFoodImageBrandMatch('BHC', 'bhc')).toBe(true);
  });

  it('does not find 프라이 inside 스프라이트 for a fried chicken item', () => {
    expect(
      isFoodImageSummaryMenuMatch(
        '후라이드 치킨과 펩시 콜라, 스프라이트가 있다.',
        '프라이',
        '후라이드 치킨',
      ),
    ).toBe(false);
    expect(
      isFoodImageSummaryMenuMatch(
        '후라이드 치킨과 펩시 콜라가 있다.',
        '후라이드 치킨',
        '후라이드 치킨',
      ),
    ).toBe(true);
  });

  it('does not reuse another same-brand food from the image summary', () => {
    const summary =
      '쟁반 위에 화이트갈릭싸이버거, 치즈감자튀김, 그리고 콜라가 놓여 있다.';

    expect(
      isFoodImageSummaryMenuMatch(
        summary,
        '화이트갈릭싸이버거',
        '콜라',
      ),
    ).toBe(false);
    expect(
      isFoodImageSummaryMenuMatch(
        summary,
        '화이트갈릭싸이버거',
        '화이트갈릭싸이버거',
      ),
    ).toBe(true);
  });

  it('keeps chicken and chicken radish as strict dish types', () => {
    expect(FOOD_IMAGE_STRICT_DISH_TYPE_TOKENS).toContain('치킨');
    expect(FOOD_IMAGE_STRICT_DISH_TYPE_TOKENS).toContain('치킨무');
    expect(
      FOOD_IMAGE_STRICT_DISH_TYPE_TOKENS.indexOf('치킨무'),
    ).toBeLessThan(FOOD_IMAGE_STRICT_DISH_TYPE_TOKENS.indexOf('치킨'));
  });
});
