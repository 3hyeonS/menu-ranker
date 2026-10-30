// 카카오 응답 파서.
// - 식당 목록: 공식 로컬 API `v2/local/search/category.json` (JSON)
// - 메뉴: 카카오맵 비공식 내부 API `place-api.map.kakao.com/places/panel3/<id>` (JSON)
// 구조는 2026-10-28 비교 분석 때 받은 실제 응답으로 확인했다.

export interface KakaoPlace {
  /** 카카오 장소 ID. 프론트가 쓰는 로컬 API 응답의 `id`와 같다. */
  id: string;
  name: string;
  /** 도로명 주소, 없으면 지번 주소. */
  address: string;
  /** `음식점 > 한식 > 육류,고기` 형태. */
  category: string;
}

export interface CategorySearchPage {
  places: KakaoPlace[];
  /** 검색 영역 안 전체 결과 수. 45를 넘으면 영역을 나눠야 다 받을 수 있다. */
  totalCount: number;
  isEnd: boolean;
}

export interface KakaoMenu {
  name: string;
  photoUrl: string;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** JSON 객체로 파싱한다. JSON이 아니거나 객체가 아니면 null. */
export function parseJsonObject(body: string): Record<string, unknown> | null {
  try {
    return record(JSON.parse(body));
  } catch {
    return null;
  }
}

export function parseCategorySearch(body: string): CategorySearchPage {
  const json = parseJsonObject(body);
  const meta = record(json?.meta);
  if (!json || !meta || !Array.isArray(json.documents))
    throw new Error('카테고리 검색 응답 형식이 아닙니다');
  const places = json.documents
    .map(record)
    .filter((doc): doc is Record<string, unknown> => doc !== null)
    .map((doc) => ({
      id: text(doc.id),
      name: text(doc.place_name),
      address: text(doc.road_address_name) || text(doc.address_name),
      category: text(doc.category_name),
    }))
    .filter((place) => place.id);
  return {
    places,
    totalCount: Number(meta.total_count) || 0,
    isEnd: meta.is_end !== false,
  };
}

/**
 * panel3 응답에서 메뉴(`menu.menus.items[]`)를 꺼낸다. 메뉴가 없는 식당은 빈 배열.
 * `menu.menus.photos`는 블로그 사진이라 메뉴별 사진으로 쓰지 않는다.
 */
export function parsePanelMenus(json: Record<string, unknown>): KakaoMenu[] {
  const items = record(record(json.menu)?.menus)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map(record)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({ name: text(item.name), photoUrl: text(item.photo_url) }))
    .filter((menu) => menu.name);
}
