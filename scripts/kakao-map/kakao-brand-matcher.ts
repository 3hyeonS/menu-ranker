// 카카오 장소(places.jsonl 한 줄)를 등록 브랜드(restaurant)에 매칭한다. DB·파일 접근 없음.
// 규칙은 #31 `## 결정` 댓글과 docs/kakao-restaurant-branch-import.md를 따른다.

export interface KakaoPlace {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
}

export interface BrandRestaurant {
  id: number;
  name: string;
}

export type BrandMatchSource = 'category' | 'name';

export interface BrandMatch {
  restaurantId: number;
  source: BrandMatchSource;
}

// 같은 브랜드를 가리키는 표기들. DB에 있는 이름이 그룹에 있으면 그룹 전체가 그 브랜드의 키가 된다.
// 카카오 카테고리·장소명에 실제로 쓰이는 표기를 넣는다.
export const BRAND_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ['BHC', 'BHC치킨'],
  ['BBQ', 'BBQ치킨'],
  ['교촌치킨', '교촌'],
  ['굽네치킨', '굽네'],
  ['지코바치킨', '지코바'],
  ['푸라닭치킨', '푸라닭'],
  ['던킨도너츠', '던킨'],
  ['한솥', '한솥도시락'],
  ['송사부고로케', '송사부수제쌀고로케'],
  ['파리바게뜨', '파리바게트'],
  ['앤티앤스 프레즐', '앤티앤스'],
  ['써브웨이', '서브웨이'],
  // 카페(CE7, #32). 나머지 카페 표기는 CE7 수집 후 미매칭 세그먼트 출력을 보고 추가한다.
  ['메가커피', '메가MGC커피'],
  ['할리스', '할리스커피'],
];

// 브랜드 키로 시작하지만 메뉴가 다른 파생 브랜드. 정규화한 장소명이나 카테고리 세그먼트가 이 값으로 시작하면 매칭하지 않는다.
export const EXCLUDED_DERIVED_BRANDS: readonly string[] = [
  '맘스터치 피자앤치킨',
  '굽네치킨 피자',
];

/** 소문자로 바꾸고 문자·숫자 외(공백·기호)를 지운다. */
export function normalizeBrandKey(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** `음식점 > 패스트푸드 > 롯데리아`처럼 3단계부터 브랜드가 들어간다. 그 세그먼트들. */
export function brandSegments(category: string | null): string[] {
  return (category ?? '')
    .split('>')
    .slice(2)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/**
 * 매칭되지 않은 장소의 마지막 카테고리 세그먼트(브랜드일 수 있는 값)를 많은 순으로 센다.
 * 카카오 표기가 DB 브랜드명과 달라 놓친 별칭을 찾는 검수용이다(예: `메가MGC커피`).
 * 프랜차이즈는 장소명에 브랜드가 들어가므로, `육류,고기`·`디저트카페` 같은 일반 분류가 목록을
 * 채우지 않도록 장소명 첫 단어가 그 세그먼트로 시작하는 장소만 센다(`메가MGC커피 문정점`).
 */
export function countUnmatchedBrandSegments(
  unmatchedPlaces: readonly KakaoPlace[],
  limit: number,
): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const place of unmatchedPlaces) {
    const segments = brandSegments(place.category);
    const segment = segments[segments.length - 1];
    const key = segment ? normalizeBrandKey(segment) : '';
    const firstWord = normalizeBrandKey(place.name.trim().split(/\s+/)[0]);
    if (!key || !firstWord.startsWith(key)) continue;
    counts.set(segment, (counts.get(segment) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

export class KakaoBrandMatcher {
  private readonly restaurantIdByKey = new Map<string, number>();
  private readonly excludedPrefixes =
    EXCLUDED_DERIVED_BRANDS.map(normalizeBrandKey);

  constructor(restaurants: readonly BrandRestaurant[]) {
    for (const restaurant of restaurants) {
      const key = normalizeBrandKey(restaurant.name);
      const group = BRAND_ALIAS_GROUPS.find((aliases) =>
        aliases.some((alias) => normalizeBrandKey(alias) === key),
      );
      for (const alias of group ?? []) {
        this.restaurantIdByKey.set(normalizeBrandKey(alias), restaurant.id);
      }
    }
    // DB 이름 자체는 별칭보다 우선한다(같은 그룹 이름이 둘 다 DB에 있을 때).
    for (const restaurant of restaurants) {
      this.restaurantIdByKey.set(
        normalizeBrandKey(restaurant.name),
        restaurant.id,
      );
    }
  }

  match(place: KakaoPlace): BrandMatch | null {
    const segments = brandSegments(place.category);
    const isDerived = [place.name, ...segments].some((value) => {
      const key = normalizeBrandKey(value);
      return this.excludedPrefixes.some((prefix) => key.startsWith(prefix));
    });
    if (isDerived) {
      return null;
    }

    for (const segment of segments) {
      const restaurantId = this.lookup(segment);
      if (restaurantId != null) {
        return { restaurantId, source: 'category' };
      }
    }

    // 접두어가 아니라 첫 단어 전체로 비교한다(`샐러디아`가 `샐러디`에 걸리지 않게).
    const firstWord = place.name.trim().split(/\s+/)[0] ?? '';
    const restaurantId = this.lookup(firstWord);
    return restaurantId != null ? { restaurantId, source: 'name' } : null;
  }

  private lookup(value: string): number | null {
    const key = normalizeBrandKey(value);
    return key ? (this.restaurantIdByKey.get(key) ?? null) : null;
  }
}

/** places.jsonl 한 줄(JSON 파싱 결과)을 검증한다. 숫자 id·name이 없으면 null. */
export function parseKakaoPlace(value: unknown): KakaoPlace | null {
  if (value == null || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = raw.id == null ? '' : String(raw.id).trim();
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!/^\d+$/.test(id) || !name) {
    return null;
  }
  return {
    id,
    name,
    address: typeof raw.address === 'string' ? raw.address : null,
    category: typeof raw.category === 'string' ? raw.category : null,
  };
}
