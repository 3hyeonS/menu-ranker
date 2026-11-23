// 구 폴더(places.jsonl·restaurants.csv·menus.csv)를 restaurant_branch·restaurant_branch_menu에 쓸 계획으로 바꾼다.
// DB·파일 접근 없음. 규칙은 #30 `## 결정` 댓글과 docs/kakao-restaurant-branch-import.md를 따른다.
import {
  BrandMatchSource,
  KakaoBrandMatcher,
  KakaoPlace,
} from './kakao-brand-matcher';
import {
  MENU_CSV_HEADERS,
  RESTAURANT_CSV_HEADERS,
} from './kakao-place-crawler';

export const MENU_NAME_MAX_LENGTH = 255;
export const PHOTO_URL_MAX_LENGTH = 512;
// restaurant_branch 컬럼 길이(kakao_place_id varchar(20), 나머지 varchar(255)).
const PLACE_ID_MAX_LENGTH = 20;
const PLACE_TEXT_MAX_LENGTH = 255;

export interface KakaoBranchMenu {
  name: string;
  photoUrl: string | null;
}

/** 구 폴더 하나를 읽은 결과. */
export interface BranchFolderInput {
  places: KakaoPlace[];
  // restaurants.csv(제외 카테고리를 뺀 음식점). 메뉴 수집 대상이었던 장소다.
  restaurants: KakaoPlace[];
  // menu-done.txt. 메뉴 수집을 마친 장소(메뉴 0개 포함). 실패한 장소는 없다.
  menuDoneIds: ReadonlySet<string>;
}

export interface BranchImportTarget {
  place: KakaoPlace;
  restaurantId: number | null;
  matchSource: BrandMatchSource | null;
  // 이 장소의 메뉴를 읽을 폴더(restaurants.csv가 있는 폴더, 없으면 places.jsonl에서 처음 나온 폴더).
  folderIndex: number;
  // restaurants.csv에 있었는지. false면 브랜드 매칭으로만 들어온(메뉴 수집 대상이 아닌) 장소다.
  listed: boolean;
  // menu-done.txt에 있는지. menus.csv에 행이 있어도 수집을 마친 것으로 본다(크롤러와 같은 기준).
  // 둘 다 아니면 수집이 실패·미완료이므로 기존 메뉴를 지우지 않는다.
  menusCollected: boolean;
}

export interface BranchImportPlan {
  targets: BranchImportTarget[];
  // 입력에 있지만 적재 대상이 아닌 장소. 예전에 브랜드로 들어갔으면 restaurant_id를 NULL로 바꾼다.
  unlinkPlaceIds: string[];
  duplicatePlaceCount: number;
  duplicateRestaurantCount: number;
  // 장소 id·이름이 컬럼보다 길어 넣지 않은 장소.
  oversizedPlaceCount: number;
}

/** 컬럼보다 긴 주소·카테고리는 버리고(null), 장소 id·이름이 길면 null을 돌려준다. */
function fitPlace(place: KakaoPlace): KakaoPlace | null {
  if (
    place.id.length > PLACE_ID_MAX_LENGTH ||
    place.name.length > PLACE_TEXT_MAX_LENGTH
  ) {
    return null;
  }
  const fit = (value: string | null) =>
    value != null && value.length <= PLACE_TEXT_MAX_LENGTH ? value : null;
  return {
    ...place,
    address: fit(place.address),
    category: fit(place.category),
  };
}

/**
 * restaurants.csv 장소 전부와, places.jsonl에서 브랜드에 매칭된 장소를 적재 대상으로 고른다.
 * 같은 장소 id는 처음 나온 것을 쓴다(구 경계 장소는 두 구에 있을 수 있다).
 */
export function planBranchImport(
  folders: readonly BranchFolderInput[],
  matcher: KakaoBrandMatcher,
): BranchImportPlan {
  const placeById = new Map<string, { place: KakaoPlace; folder: number }>();
  const restaurantFolderById = new Map<string, number>();
  const csvPlaceById = new Map<string, KakaoPlace>();
  let duplicatePlaceCount = 0;
  let duplicateRestaurantCount = 0;
  let oversizedPlaceCount = 0;

  folders.forEach((folder, folderIndex) => {
    for (const place of folder.places) {
      if (placeById.has(place.id)) {
        duplicatePlaceCount += 1;
        continue;
      }
      placeById.set(place.id, { place, folder: folderIndex });
    }
    for (const restaurant of folder.restaurants) {
      if (restaurantFolderById.has(restaurant.id)) {
        duplicateRestaurantCount += 1;
        continue;
      }
      restaurantFolderById.set(restaurant.id, folderIndex);
      csvPlaceById.set(restaurant.id, restaurant);
    }
  });

  const targets: BranchImportTarget[] = [];
  const unlinkPlaceIds: string[] = [];
  const placeIds = new Set([...placeById.keys(), ...csvPlaceById.keys()]);
  for (const placeId of placeIds) {
    const found = placeById.get(placeId);
    // restaurants.csv는 places.jsonl에서 만들어지므로 보통 둘 다 있다. 카테고리는 places.jsonl에만 있다.
    const place = fitPlace(found?.place ?? csvPlaceById.get(placeId));
    if (!place) {
      oversizedPlaceCount += 1;
      continue;
    }
    const restaurantFolder = restaurantFolderById.get(placeId);
    const match = matcher.match(place);
    if (restaurantFolder == null && !match) {
      unlinkPlaceIds.push(placeId);
      continue;
    }
    targets.push({
      place,
      restaurantId: match?.restaurantId ?? null,
      matchSource: match?.source ?? null,
      folderIndex: restaurantFolder ?? found.folder,
      listed: restaurantFolder != null,
      menusCollected:
        restaurantFolder != null &&
        folders[restaurantFolder].menuDoneIds.has(placeId),
    });
  }

  return {
    targets,
    unlinkPlaceIds,
    duplicatePlaceCount,
    duplicateRestaurantCount,
    oversizedPlaceCount,
  };
}

function assertHeaders(
  rows: string[][],
  expected: readonly string[],
  label: string,
): void {
  const headers = (rows[0] ?? []).map((header) => header.trim());
  if (expected.some((header, index) => headers[index] !== header)) {
    throw new Error(
      `${label} 헤더가 다릅니다: 기대 ${expected.join(',')}, 실제 ${headers.join(',')}`,
    );
  }
}

/** restaurants.csv(`장소id,식당명,주소`). 형식이 틀린 행은 건너뛰고 센다. */
export function parseRestaurantRows(rows: string[][]): {
  restaurants: KakaoPlace[];
  invalidRowCount: number;
} {
  assertHeaders(rows, RESTAURANT_CSV_HEADERS, 'restaurants.csv');
  const restaurants: KakaoPlace[] = [];
  let invalidRowCount = 0;
  for (const [id = '', name = '', address = ''] of rows.slice(1)) {
    if (!/^\d+$/.test(id.trim()) || !name.trim()) {
      invalidRowCount += 1;
      continue;
    }
    restaurants.push({
      id: id.trim(),
      name: name.trim(),
      address: address.trim() || null,
      category: null,
    });
  }
  return { restaurants, invalidRowCount };
}

/** iOS ATS 때문에 http:// 사진 URL을 https://로 바꾼다(#30 결정). */
export function toHttpsPhotoUrl(value: string): string | null {
  const url = value.trim();
  if (!url) {
    return null;
  }
  return url.replace(/^http:\/\//i, 'https://');
}

export interface ParsedMenus {
  menusByPlaceId: Map<string, KakaoBranchMenu[]>;
  menuCount: number;
  invalidRowCount: number;
  droppedPhotoCount: number;
}

/**
 * menus.csv(`메뉴명,사진URL,식당id`)를 장소별로 묶는다. 순서는 파일 순서(카카오 표시 순서)다.
 * 메뉴명이 비었거나 너무 긴 행은 건너뛰고, 컬럼보다 긴 사진 URL은 null로 둔다.
 */
export function parseMenuRows(rows: string[][]): ParsedMenus {
  assertHeaders(rows, MENU_CSV_HEADERS, 'menus.csv');
  const menusByPlaceId = new Map<string, KakaoBranchMenu[]>();
  let menuCount = 0;
  let invalidRowCount = 0;
  let droppedPhotoCount = 0;

  for (const [rawName = '', rawPhotoUrl = '', rawPlaceId = ''] of rows.slice(
    1,
  )) {
    const name = rawName.trim();
    const placeId = rawPlaceId.trim();
    if (!name || name.length > MENU_NAME_MAX_LENGTH || !/^\d+$/.test(placeId)) {
      invalidRowCount += 1;
      continue;
    }
    let photoUrl = toHttpsPhotoUrl(rawPhotoUrl);
    if (photoUrl && photoUrl.length > PHOTO_URL_MAX_LENGTH) {
      photoUrl = null;
      droppedPhotoCount += 1;
    }
    const menus = menusByPlaceId.get(placeId) ?? [];
    menus.push({ name, photoUrl });
    menusByPlaceId.set(placeId, menus);
    menuCount += 1;
  }

  return { menusByPlaceId, menuCount, invalidRowCount, droppedPhotoCount };
}
