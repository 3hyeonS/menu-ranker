import { FOOD_IMAGE_DISH_GROUPING_PROMPT_RULES } from './food-image-recognition.util';

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
});
