export const FOOD_IMAGE_DISH_GROUPING_PROMPT_RULES = `
- 먼저 사진 속 음식이 하나의 완성 요리인지, 서로 독립된 여러 음식인지 판단해.
- 같은 그릇이나 용기 안에서 밥과 여러 재료가 함께 구성되어 하나의 메뉴로 먹는 음식은 재료별로 쪼개지 말고 완성 음식 하나로 반환해.
- 비빔밥은 "비빔밥" 하나로 반환하고 밥, 달걀후라이, 콩나물, 당근, 상추, 햄구이를 동시에 별도 음식으로 반환하지 마.
- 볶음밥, 덮밥, 비빔면, 샐러드, 파스타처럼 한 그릇 완성 요리도 같은 원칙을 적용해.
- 완성 요리와 별도로 담긴 국, 음료, 포장 제품, 반찬, 소스만 각각 독립된 음식으로 분리해.
- 식판, 도시락, 한상차림처럼 칸이나 그릇이 물리적으로 나뉜 경우에는 밥, 국/찌개, 고기·생선·계란 반찬, 채소 반찬, 김치·절임류, 소스를 가능한 한 개별 음식으로 분리해.
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
