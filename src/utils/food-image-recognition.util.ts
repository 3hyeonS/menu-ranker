export const FOOD_IMAGE_DISH_GROUPING_PROMPT_RULES = `
- 먼저 사진 속 음식이 하나의 완성 요리인지, 서로 독립된 여러 음식인지 판단해.
- 같은 그릇이나 용기 안에서 밥과 여러 재료가 함께 구성되어 하나의 메뉴로 먹는 음식은 재료별로 쪼개지 말고 완성 음식 하나로 반환해.
- 비빔밥은 "비빔밥" 하나로 반환하고 밥, 달걀후라이, 콩나물, 당근, 상추, 햄구이를 동시에 별도 음식으로 반환하지 마.
- 볶음밥, 덮밥, 비빔면, 샐러드, 파스타처럼 한 그릇 완성 요리도 같은 원칙을 적용해.
- 완성 요리와 별도로 담긴 국, 음료, 포장 제품, 반찬, 소스만 각각 독립된 음식으로 분리해.
- 식판, 도시락, 한상차림처럼 칸이나 그릇이 물리적으로 나뉜 경우에는 밥, 국/찌개, 고기·생선·계란 반찬, 채소 반찬, 김치·절임류, 소스를 가능한 한 개별 음식으로 분리해.
`.trim();

export const FOOD_IMAGE_CORE_DETECTION_PROMPT_RULES = `
- 사진 속 음식은 DB 후보를 의식하지 말고 시각적으로 보이는 실제 음식 기준으로 먼저 판독해.
- food_name에는 가장 구체적인 음식명이나 제품명을 넣되 브랜드명은 제외하고, 브랜드는 brand에 따로 넣어.
- 포장·용기·로고에서 제품명과 브랜드를 확실히 읽을 수 있으면 일반 음식명으로 줄이지 말고 그대로 사용해.
- 제품명이 불확실해도 음식 종류가 보이면 가장 가까운 일반 음식명으로 반환하고 임의의 상품명을 만들지 마.
- image_summary에 음식으로 언급한 항목은 detected_foods에도 포함해 누락되지 않게 해.
${FOOD_IMAGE_DISH_GROUPING_PROMPT_RULES}
- 같은 음식이 여러 개 보이면 detected_foods에는 한 번만 넣고 사진에 보이는 전체 양을 합산해.
- 각 음식의 실제 전체 양을 estimated_quantity로 추정해. 고형 음식은 g, 음료·국물은 ml를 사용해.
- 접시, 컵, 수저, 포장 용량을 크기 단서로 활용하고, 단서가 부족하면 일반적인 1인분을 기준으로 보수적으로 추정해.
- quantity_confidence는 음식명 confidence와 별도로 0~1 사이 값으로 반환해.
- 고기나 채소를 찍어 먹는 흰 결정 형태의 소금이 별도 종지에 보이면 "소금"을 포함하되, 액체 기름장이나 다른 양념장은 소금으로 단정하지 마.
`.trim();

export const FOOD_IMAGE_REMATCH_PROMPT_RULES = `
- 각 음식은 해당 food_index에 제공된 후보 menu_id 중에서만 선택해.
- 사진의 시각 정보, 1차 food_name, 후보 메뉴명/브랜드/카테고리를 함께 비교해.
- 인식된 brand가 있으면 같은 브랜드의 후보를 우선하되, 브랜드만 같고 음식 종류가 다른 메뉴는 선택하지 마.
- food_name이 완성 음식 형태를 포함하면 후보도 같은 형태여야 해. 예: 김치볶음밥과 김치볶음, 참치김밥과 참치샐러드는 서로 다른 음식이야.
- 일반적인 "계란 후라이" 또는 "달걀 후라이"는 냉동 제품이나 패티 단서가 없으면 "(식약처_음식) 달걀후라이"를 우선해.
- 일반적인 "밥", "흰밥", "쌀밥", "백미밥"은 포장이나 브랜드 단서가 없으면 "(식약처_음식) 밥"을 우선해.
- 일반적인 "소금", "정제염", "식염", "소금장", "소금 양념장"은 "(식약처_가공) 정제염"(menu_id 219056)을 우선해.
- 한 음식에 확실히 맞는 후보가 없으면 그 음식은 제외해.
- 같은 메뉴가 여러 위치에 보여도 같은 menu_id는 한 번만 반환해.
`.trim();

export const FOOD_IMAGE_STRICT_DISH_TYPE_TOKENS = [
  '볶음밥',
  '비빔밥',
  '덮밥',
  '국밥',
  '주먹밥',
  '김밥',
  '초밥',
  '샤브샤브',
  '파스타',
  '스파게티',
  '짜장면',
  '자장면',
  '짬뽕',
  '냉면',
  '국수',
  '라면',
  '우동',
  '찌개',
  '전골',
  '샐러드',
  '스테이크',
  '돈가스',
  '돈까스',
  '카츠',
  '피자',
  '버거',
  '만두',
  '치킨무',
  '닭튀김',
  '치킨',
  '튀김',
  '구이',
  '조림',
  '볶음',
  '무침',
  '찜',
  '탕',
] as const;

const normalizeFoodImageMatchText = (value: string): string =>
  (value ?? '')
    .toLowerCase()
    .replace(/[^\w가-힣]/g, '');

type FoodImageScoringCandidate = {
  name: string;
  brand?: string | null;
  category?: string | null;
};

const normalizeFoodImageScoreText = (value: string): string =>
  (value ?? '')
    .toLowerCase()
    .replace(/계란/g, '달걀')
    .replace(/후라이/g, '프라이')
    .replace(/[^\w가-힣\s]/g, ' ')
    .replace(/\s+/g, '')
    .trim();

const toBigramCounts = (value: string): Map<string, number> => {
  const counts = new Map<string, number>();

  for (let index = 0; index < value.length - 1; index += 1) {
    const bigram = value.slice(index, index + 2);
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }

  return counts;
};

const calculateCharacterDiceScore = (left: string, right: string): number => {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  if (left.length === 1 || right.length === 1) {
    return left === right ? 1 : 0;
  }

  const leftBigrams = toBigramCounts(left);
  const rightBigrams = toBigramCounts(right);
  let intersection = 0;

  leftBigrams.forEach((count, bigram) => {
    intersection += Math.min(count, rightBigrams.get(bigram) ?? 0);
  });

  return (2 * intersection) / (left.length - 1 + right.length - 1);
};

const isLikelyStandaloneIngredient = (value: string): boolean =>
  [
    '베이컨',
    '치즈',
    '토마토',
    '양상추',
    '상추',
    '양파',
    '피클',
    '소스',
    '마요네즈',
    '마요',
    '햄',
  ].includes(normalizeFoodImageScoreText(value));

/**
 * 홈과 채팅 음식 사진 인식이 동일한 후보 점수를 사용하도록 한 곳에서 계산한다.
 */
export const calculateFoodImageCandidateScore = (
  inputName: string,
  menu: FoodImageScoringCandidate,
  inferredBrand: string | null,
  inferredCategory: string | null,
): number => {
  const input = normalizeFoodImageScoreText(inputName);
  const menuName = normalizeFoodImageScoreText(menu.name);
  const brand = normalizeFoodImageScoreText(menu.brand ?? '');
  const category = normalizeFoodImageScoreText(menu.category ?? '');
  const searchable = `${menuName}${brand}${category}`;

  if (!input) {
    return 0;
  }

  let score = 0;

  if (menuName === input) {
    score = 100;
  } else if (menuName.includes(input) || input.includes(menuName)) {
    score = 84;
  } else if (searchable.includes(input)) {
    score = 74;
  } else if (
    category &&
    (input.includes(category) || category.includes(input))
  ) {
    score = 68;
  } else {
    score = calculateCharacterDiceScore(input, menuName) * 72;
  }

  const inferredBrandText = normalizeFoodImageScoreText(inferredBrand ?? '');
  const inferredCategoryText = normalizeFoodImageScoreText(
    inferredCategory ?? '',
  );

  if (inferredBrandText && brand && brand.includes(inferredBrandText)) {
    score += 6;
  }
  if (
    inferredCategoryText &&
    category &&
    category.includes(inferredCategoryText)
  ) {
    score += 4;
  }

  if (
    isLikelyStandaloneIngredient(inputName) &&
    menuName === input &&
    !['샌드위치', '버거', '샐러드'].some((dishCategory) =>
      category.includes(dishCategory),
    )
  ) {
    score -= 45;
  }

  return Math.min(score, 100);
};

/**
 * BHC처럼 짧은 브랜드를 부분 일치시키면 GMBH & CO도 BHC로 오인하므로
 * 4자 미만 브랜드는 정규화 후 완전히 같을 때만 인정한다.
 */
export const isFoodImageBrandMatch = (
  recognizedBrand: string,
  candidateBrand: string,
): boolean => {
  const recognized = normalizeFoodImageMatchText(recognizedBrand);
  const candidate = normalizeFoodImageMatchText(candidateBrand);

  if (!recognized || !candidate) {
    return false;
  }

  if (recognized === candidate) {
    return true;
  }

  return (
    Math.min(recognized.length, candidate.length) >= 4 &&
    (recognized.includes(candidate) || candidate.includes(recognized))
  );
};

/**
 * 짧은 메뉴명은 스프라이트 안의 "프라이" 같은 우연한 부분 일치가 많으므로
 * 인식된 개별 음식명과도 직접 연결되는 경우에만 허용한다.
 */
export const isFoodImageSummaryMenuMatch = (
  imageSummary: string,
  candidateMenuName: string,
  recognizedFoodName: string,
): boolean => {
  const summary = normalizeFoodImageMatchText(imageSummary);
  const candidate = normalizeFoodImageMatchText(candidateMenuName);
  const recognized = normalizeFoodImageMatchText(recognizedFoodName);

  if (!summary || !candidate || !summary.includes(candidate)) {
    return false;
  }

  return (
    candidate.length >= 4 ||
    recognized.includes(candidate) ||
    candidate.includes(recognized)
  );
};
