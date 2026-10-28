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

// 지역 검색 결과 항목. 키는 `PlaceListBusinessesItem:<id>:<id>`.
const LIST_ITEM_TYPE = 'PlaceListBusinessesItem';

// 목록의 roadAddress·address에는 시·구가 없어(`백제고분로7길 53 1층`)
// commonAddress(`서울 송파구 잠실동`)의 앞 두 단어를 붙인다.
function listItemAddress(value: Record<string, unknown>): string {
  const cityDistrict = text(value.commonAddress)
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');
  const local = text(value.roadAddress) || text(value.address);
  if (cityDistrict && local) return `${cityDistrict} ${local}`;
  return text(value.fullAddress) || local;
}

function toPlaceSummary(
  value: Record<string, unknown>,
  address: string,
): PlaceSummary | null {
  const placeId = text(value.id);
  const name = text(value.name);
  if (!/^\d+$/.test(placeId) || !name) return null;
  return { placeId, name, address, category: text(value.category) };
}

/** 지역 검색 목록 페이지(`/restaurant/list`)에서 식당 요약을 캐시 순서대로 뽑는다. */
export function parseRestaurantList(html: string): PlaceSummary[] {
  const state = extractApolloState(html);
  if (!state) throw new Error('목록 페이지에 __APOLLO_STATE__가 없습니다');
  const seen = new Set<string>();
  const places: PlaceSummary[] = [];
  for (const [key, value] of Object.entries(state)) {
    if (!value || typeName(key, value) !== LIST_ITEM_TYPE) continue;
    const place = toPlaceSummary(value, listItemAddress(value));
    if (!place || seen.has(place.placeId)) continue;
    seen.add(place.placeId);
    places.push(place);
  }
  return places;
}

// 메뉴 항목. 키는 `PlaceMenuItem:<불투명 id>`이고 메뉴 페이지에는 그 식당 메뉴만 실린다.
const MENU_ITEM_TYPE = 'PlaceMenuItem';
// 추천 메뉴 분류는 다른 분류의 항목을 다시 담으므로 순서 계산에서 뺀다.
const RECOMMEND_CATEGORY_KIND = 'recommend';

function firstImageUrl(value: Record<string, unknown>): string {
  const images = Array.isArray(value.images) ? value.images : [];
  for (const image of images) {
    const url =
      typeof image === 'string'
        ? image
        : text((image as Record<string, unknown>)?.url);
    if (url) return url.trim();
  }
  return text(value.thumbnailUrl);
}

// price는 `{ priceType, displayText: '10,000원' }` 객체다.
function priceText(price: unknown): string {
  if (price && typeof price === 'object')
    return text((price as Record<string, unknown>).displayText);
  return text(price);
}

function toMenu(value: Record<string, unknown>): PlaceMenu | null {
  const name = text(value.name);
  if (!name) return null;
  return {
    name,
    price: priceText(value.price),
    imageUrl: firstImageUrl(value),
  };
}

/**
 * 메뉴 페이지(`/restaurant/<id>/menu/list`)에서 식당 기본 정보와 메뉴를 뽑는다.
 * 메뉴 순서는 추천이 아닌 `PlaceMenuCategory.itemIds` 순서를 따르고(분류에 없는 항목은 뒤에),
 * 같은 이름·가격은 하나로 합친다.
 */
export function parseMenuPage(html: string, placeId: string): PlaceMenuPage {
  const state = extractApolloState(html);
  if (!state)
    throw new Error(`메뉴 페이지에 __APOLLO_STATE__가 없습니다: ${placeId}`);
  const base = state[`PlaceDetailBase:${placeId}`];
  const place = base
    ? toPlaceSummary(
        { ...base, id: placeId },
        text(base.roadAddress) || text(base.address),
      )
    : null;

  const items = new Map<string, Record<string, unknown>>();
  const orderedIds: string[] = [];
  for (const [key, value] of Object.entries(state)) {
    if (!value) continue;
    const type = typeName(key, value);
    if (type === MENU_ITEM_TYPE) items.set(text(value.id), value);
    else if (
      type === 'PlaceMenuCategory' &&
      value.kind !== RECOMMEND_CATEGORY_KIND &&
      Array.isArray(value.itemIds)
    )
      orderedIds.push(...value.itemIds.map(text));
  }

  const seenIds = new Set<string>();
  const seenMenus = new Set<string>();
  const menus: PlaceMenu[] = [];
  for (const id of [...orderedIds, ...items.keys()]) {
    const item = items.get(id);
    if (!item || seenIds.has(id)) continue;
    seenIds.add(id);
    const menu = toMenu(item);
    if (!menu) continue;
    const dedupeKey = `${menu.name}\u0000${menu.price}`;
    if (seenMenus.has(dedupeKey)) continue;
    seenMenus.add(dedupeKey);
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
