// 네이버 플레이스 PC 페이지(pcmap.place.naver.com) HTML 파서.
// 페이지는 서버 렌더링 시 `window.__APOLLO_STATE__ = {...};`에 정규화된 Apollo 캐시를 싣는다.
// 키는 `<__typename>:<id>` 형태이고 객체 사이 참조는 `{ __ref: '<키>' }`다.

export type ApolloState = Record<string, Record<string, unknown>>;

export interface PlaceSummary {
  placeId: string;
  name: string;
  address: string;
  category: string;
}

export interface PlaceMenu {
  name: string;
  price: string;
  imageUrl: string;
}

export interface PlaceMenuPage {
  place: PlaceSummary | null;
  menus: PlaceMenu[];
}

const APOLLO_STATE_MARKER = /window\.__APOLLO_STATE__\s*=\s*/;

/** HTML에서 `window.__APOLLO_STATE__` JSON 객체를 꺼낸다. 없으면 null. */
export function extractApolloState(html: string): ApolloState | null {
  const match = APOLLO_STATE_MARKER.exec(html);
  if (!match) return null;
  const start = html.indexOf('{', match.index + match[0].length);
  if (start < 0) return null;
  const end = findMatchingBrace(html, start);
  if (end < 0) return null;
  return JSON.parse(html.slice(start, end + 1)) as ApolloState;
}

// 문자열 리터럴 안의 중괄호는 무시하고 짝이 맞는 닫는 중괄호 위치를 찾는다.
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (character === '\\') index += 1;
      else if (character === '"') inString = false;
    } else if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function typeName(key: string, value: Record<string, unknown>): string {
  return text(value.__typename) || key.split(':')[0];
}

// 지역 검색 결과 요약 타입. 업종에 따라 타입 이름이 달라 접미사로 판별한다.
const LIST_SUMMARY_TYPE = /ListSummary$/;

function toPlaceSummary(value: Record<string, unknown>): PlaceSummary | null {
  const placeId = text(value.id);
  const name = text(value.name);
  if (!/^\d+$/.test(placeId) || !name) return null;
  return {
    placeId,
    name,
    address:
      text(value.roadAddress) || text(value.fullAddress) || text(value.address),
    category: text(value.category),
  };
}

/** 지역 검색 목록 페이지(`/restaurant/list`)에서 식당 요약을 페이지 순서대로 뽑는다. */
export function parseRestaurantList(html: string): PlaceSummary[] {
  const state = extractApolloState(html);
  if (!state) throw new Error('목록 페이지에 __APOLLO_STATE__가 없습니다');
  const seen = new Set<string>();
  const places: PlaceSummary[] = [];
  for (const [key, value] of Object.entries(state)) {
    if (!value || !LIST_SUMMARY_TYPE.test(typeName(key, value))) continue;
    const place = toPlaceSummary(value);
    if (!place || seen.has(place.placeId)) continue;
    seen.add(place.placeId);
    places.push(place);
  }
  return places;
}

// 메뉴 타입: 플레이스 등록 메뉴(`Menu`)와 주문 연동 메뉴(`...Menu`).
const MENU_TYPE = /Menu$/;

function firstImageUrl(images: unknown): string {
  if (!Array.isArray(images)) return text(images);
  for (const image of images) {
    const url =
      typeof image === 'string'
        ? image
        : text((image as Record<string, unknown>)?.url) ||
          text((image as Record<string, unknown>)?.origin);
    if (url) return url.trim();
  }
  return '';
}

function toMenu(value: Record<string, unknown>): PlaceMenu | null {
  const name = text(value.name);
  if (!name) return null;
  return {
    name,
    price: text(value.price),
    imageUrl: firstImageUrl(value.images),
  };
}

function menuOrder(key: string, value: Record<string, unknown>): number {
  if (typeof value.index === 'number') return value.index;
  const suffix = /_(\d+)$/.exec(key);
  return suffix ? Number(suffix[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * 메뉴 페이지(`/restaurant/<id>/menu/list`)에서 식당 기본 정보와 메뉴를 뽑는다.
 * 메뉴 순서는 `index` 필드(없으면 키의 `_<번호>`)를 따르고, 같은 이름·가격은 하나로 합친다.
 */
export function parseMenuPage(html: string, placeId: string): PlaceMenuPage {
  const state = extractApolloState(html);
  if (!state)
    throw new Error(`메뉴 페이지에 __APOLLO_STATE__가 없습니다: ${placeId}`);
  const base = state[`PlaceDetailBase:${placeId}`];
  const place = base ? toPlaceSummary({ ...base, id: placeId }) : null;

  const entries: Array<{ order: number; menu: PlaceMenu }> = [];
  for (const [key, value] of Object.entries(state)) {
    if (!value || !MENU_TYPE.test(typeName(key, value))) continue;
    // 다른 식당 메뉴가 캐시에 섞여 있으면 제외한다(키가 `<타입>:<placeId>_<번호>` 형태일 때).
    const id = key.slice(key.indexOf(':') + 1);
    // `<placeId>_<번호>`가 아닌 키는 어느 식당 것인지 알 수 없으므로 기본 `Menu` 타입만 받는다.
    if (/^\d+_\d+$/.test(id) && !id.startsWith(`${placeId}_`)) continue;
    if (!id.startsWith(`${placeId}_`) && typeName(key, value) !== 'Menu')
      continue;
    const menu = toMenu(value);
    if (menu) entries.push({ order: menuOrder(key, value), menu });
  }
  entries.sort((left, right) => left.order - right.order);

  const seen = new Set<string>();
  const menus: PlaceMenu[] = [];
  for (const { menu } of entries) {
    const dedupeKey = `${menu.name}\u0000${menu.price}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    menus.push(menu);
  }
  return { place, menus };
}

/** 응답이 차단·보안 확인 페이지인지 대략 판별한다(200으로 오는 경우 대비). */
export function looksBlocked(html: string): boolean {
  return (
    /captcha|비정상적인 접근|일시적으로 제한|자동입력 방지/i.test(html) &&
    !APOLLO_STATE_MARKER.test(html)
  );
}
