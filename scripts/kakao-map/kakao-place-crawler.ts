import {
  appendFileSync,
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import {
  csvField,
  csvHeaderLine,
  ensureCsv,
  readJsonLines,
  readLines,
} from '../crawl-common/crawl-files';
import {
  BlockedError,
  HttpFetcher,
  PoliteRequester,
  RequestPolicy,
  RequesterDeps,
} from '../crawl-common/polite-requester';
import {
  KakaoMenu,
  KakaoPlace,
  parseCategorySearch,
  parseJsonObject,
  parsePanelMenus,
} from './kakao-place-parser';

export const RESTAURANT_CSV_HEADERS = ['장소id', '식당명', '주소'] as const;
export const MENU_CSV_HEADERS = ['메뉴명', '사진URL', '식당id'] as const;

/**
 * 카카오 로컬 API `category_group_code`. FD6: 음식점(식당·메뉴 수집), CE7: 카페(장소 목록만, #32).
 * CE7은 카페가 대상이라 카페·디저트 제외 필터와 메뉴 수집을 쓰지 않는다.
 */
export const KAKAO_CATEGORY_GROUPS = ['FD6', 'CE7'] as const;
export type KakaoCategoryGroup = (typeof KAKAO_CATEGORY_GROUPS)[number];

/** 경도·위도 사각형 [x1, y1, x2, y2] (왼쪽 아래, 오른쪽 위). */
export type Rect = [number, number, number, number];

/** 카테고리 검색 한 번에 받을 수 있는 최대 결과 수(15개 × 3쪽). */
export const SEARCH_RESULT_LIMIT = 45;
const SEARCH_PAGE_SIZE = 15;
/**
 * 4등분한 사각형의 가로·세로가 이보다 작아지면 더 나누지 않는다(약 1m).
 * 좌표를 소수 6자리로 보내므로 더 작으면 반올림으로 사각형이 겹치거나 폭이 0이 된다.
 * 루트 사각형이 작으면(#47 지역 목록은 0.01도) --max-depth보다 먼저 이 조건에 걸린다.
 */
export const MIN_SPLIT_DEG = 1e-5;
/** 다시 요청해도 같은 "없는 장소" 응답. */
const GONE_STATUS = new Set([404, 410]);

function isCategorySearch(body: string): boolean {
  try {
    parseCategorySearch(body);
    return true;
  } catch {
    return false;
  }
}

export interface KakaoCrawlOptions {
  restApiKey: string;
  categoryGroup: KakaoCategoryGroup;
  /**
   * 검색 사각형들. 순서대로 하나씩 재귀 검색한다. 한 지역을 bbox 하나 대신 경계를 덮는 작은 사각형 여러 개로
   * 주면 이웃 지역(서울 등)을 덜 훑는다(#47). 사각형끼리 겹치면 겹친 곳은 두 번 검색한다.
   */
  rects: Rect[];
  /** 주소에 이 문자열이 있는 식당만 남긴다. 빈 문자열이면 거르지 않는다. */
  district: string;
  /**
   * 사각형을 4등분하는 최대 깊이. 이 깊이에서도 45곳을 넘으면 45곳만 받는다.
   * 좌표를 소수 6자리로 보내므로 너무 깊으면 사각형이 겹친다(CLI가 14로 제한).
   */
  maxDepth: number;
  /** 카테고리에 이 문자열 중 하나가 들어 있으면 식당·메뉴에서 뺀다(카페·술집 등). */
  excludedCategories: string[];
  /** 공식 로컬 API 요청 정책. */
  search: RequestPolicy;
  /** 비공식 panel3 요청 정책. */
  panel: RequestPolicy;
  /** panel3 `appVersion` 헤더. */
  appVersion: string;
  concurrency: number;
  /** 이번 실행에서 메뉴를 수집할 최대 식당 수(시험 실행용). 0이면 제한 없음. */
  maxPlaces: number;
  /** true면 식당 목록만 모으고 메뉴 수집은 하지 않는다. */
  discoverOnly: boolean;
}

export type KakaoCrawlDeps = RequesterDeps;

export interface KakaoCrawlSummary {
  searchedRects: number;
  /** 더 나눌 수 없는 사각형(최대 깊이·최소 폭 MIN_SPLIT_DEG)에서도 45곳을 넘어 일부만 받은 사각형 수(이전 실행 포함). */
  truncatedRects: number;
  /** 이번 실행에서 재시도를 소진해 실패한 검색 사각형 수. 다음 실행에서 다시 검색한다. */
  failedRects: number;
  discoveredPlaces: number;
  restaurants: number;
  excludedByCategory: number;
  crawledPlaces: number;
  skippedPlaces: number;
  failedPlaces: number;
  menuRows: number;
  menuRowsWithPhoto: number;
}

const SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/category.json';

/**
 * 카카오 rect 검색은 경계 판정 오차가 사각형 크기에 비례한다(2026-11-27 측정: 폭 0.035도 리프에서
 * 경계 4m 안쪽 장소가 빠지고 경계를 1e-4도 넓히면 나옴, 폭 0.016도 이하에서는 1e-5도까지 정확).
 * 그래서 리프 경계 근처 장소가 양쪽 리프에서 모두 빠진다(#47 시험 수집에서 약 1%).
 * 요청할 때만 긴 변의 이 비율(최소 SEARCH_RECT_MIN_MARGIN_DEG)만큼 사방으로 넓혀 이웃과 겹치게 한다.
 * 진행 기록(search-rects.txt)은 원래 사각형 키로 남겨 기존 폴더의 재시작과 호환된다. 겹쳐 나온 장소는 ID로 거른다.
 */
export const SEARCH_RECT_MARGIN_RATIO = 0.01;
export const SEARCH_RECT_MIN_MARGIN_DEG = 1e-5;

export function expandSearchRect([x1, y1, x2, y2]: Rect): Rect {
  const margin = Math.max(
    Math.max(x2 - x1, y2 - y1) * SEARCH_RECT_MARGIN_RATIO,
    SEARCH_RECT_MIN_MARGIN_DEG,
  );
  return [x1 - margin, y1 - margin, x2 + margin, y2 + margin];
}

/**
 * `rect`(진행 기록 기준 사각형)를 요청하는 URL. 기본은 expandSearchRect로 넓혀 보낸다.
 * 더 나눌 수 없어 45곳만 받는 사각형은 넓힌 여백의 이웃 장소가 자리를 차지하지 않도록 넓히지 않는다.
 */
export function categorySearchUrl(
  rect: Rect,
  page: number,
  categoryGroup: KakaoCategoryGroup = 'FD6',
  expand = true,
): string {
  const params = new URLSearchParams({
    category_group_code: categoryGroup,
    rect: rectKey(expand ? expandSearchRect(rect) : rect),
    page: String(page),
    size: String(SEARCH_PAGE_SIZE),
  });
  return `${SEARCH_URL}?${params.toString()}`;
}

export function panelUrl(placeId: string): string {
  return `https://place-api.map.kakao.com/places/panel3/${placeId}`;
}

export function rectKey(rect: Rect): string {
  return rect.map((value) => value.toFixed(6)).join(',');
}

/** `x1,y1,x2,y2` 하나. 여러 개면 `;`로 잇는다(지역 목록 파일의 사각형 칸, #47). */
export function parseRects(raw: string): Rect[] {
  const rects = raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const values = part.split(',').map(Number);
      if (
        values.length !== 4 ||
        values.some((value) => !Number.isFinite(value)) ||
        values[0] >= values[2] ||
        values[1] >= values[3]
      )
        throw new Error(
          `--rect는 x1,y1,x2,y2(x1<x2, y1<y2)를 ;로 이은 값이어야 합니다: ${part}`,
        );
      return values as Rect;
    });
  if (!rects.length) throw new Error(`--rect에 사각형이 없습니다: ${raw}`);
  return rects;
}

/** 가로세로 비가 이보다 크면 긴 축으로만 2등분한다. */
export const SPLIT_ASPECT_LIMIT = 2;

/**
 * 45곳을 넘는 사각형을 나눈다. 보통은 4등분이고, 가늘고 긴 사각형(#47 지역 목록은 최대 57:1)은
 * 긴 축으로만 2등분해 정사각형에 가깝게 만든다. 4등분은 비율을 유지하므로, 그대로 두면 짧은 변이
 * MIN_SPLIT_DEG에 먼저 닿아 긴 변이 100m 넘게 남은 채로 더 나누지 못하고, 긴 변 기준 여백이
 * 짧은 변 쪽 검색 범위를 몇 배로 키운다. 서울 지역 사각형은 비가 2 미만이라 4등분만 쓴다(기존 진행 기록과 같음).
 */
export function splitRect(rect: Rect): Rect[] {
  const [x1, y1, x2, y2] = rect;
  const width = x2 - x1;
  const height = y2 - y1;
  if (width > height * SPLIT_ASPECT_LIMIT) {
    const mx = (x1 + x2) / 2;
    return [
      [x1, y1, mx, y2],
      [mx, y1, x2, y2],
    ];
  }
  if (height > width * SPLIT_ASPECT_LIMIT) {
    const my = (y1 + y2) / 2;
    return [
      [x1, y1, x2, my],
      [x1, my, x2, y2],
    ];
  }
  return quarters(rect);
}

function quarters([x1, y1, x2, y2]: Rect): Rect[] {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return [
    [x1, y1, mx, my],
    [mx, y1, x2, my],
    [x1, my, mx, y2],
    [mx, my, x2, y2],
  ];
}

export function toRestaurantRow(place: KakaoPlace): string {
  return [place.id, place.name, place.address].map(csvField).join(',');
}

export function toMenuRows(placeId: string, menus: KakaoMenu[]): string[] {
  return menus.map((menu) =>
    [menu.name, menu.photoUrl, placeId].map(csvField).join(','),
  );
}

// ---- 결과·진행 상태 파일 (출력 폴더 안) ----

const RESTAURANT_HEADER_LINE = csvHeaderLine(RESTAURANT_CSV_HEADERS);
const MENU_HEADER_LINE = csvHeaderLine(MENU_CSV_HEADERS);

export class KakaoCrawlStore {
  readonly restaurantsPath: string;
  readonly menusPath: string;
  readonly placesPath: string;
  readonly rectsPath: string;
  readonly menuDonePath: string;
  readonly failedPath: string;
  readonly categoryGroupPath: string;

  constructor(readonly dir: string) {
    this.restaurantsPath = join(dir, 'restaurants.csv');
    this.menusPath = join(dir, 'menus.csv');
    this.placesPath = join(dir, 'places.jsonl');
    this.rectsPath = join(dir, 'search-rects.txt');
    this.menuDonePath = join(dir, 'menu-done.txt');
    this.failedPath = join(dir, 'failed.jsonl');
    this.categoryGroupPath = join(dir, 'category-group.txt');
  }

  /** 이 저장소가 쓰는 모든 파일 경로. */
  get paths(): string[] {
    return [
      this.restaurantsPath,
      this.menusPath,
      this.placesPath,
      this.rectsPath,
      this.menuDonePath,
      this.failedPath,
      this.categoryGroupPath,
    ];
  }

  /**
   * 출력 폴더의 카테고리 그룹을 확인하고 기록한다.
   * 끝난 사각형 기록(`search-rects.txt`)은 그룹을 구분하지 않으므로, 음식점 폴더에서 카페를 검색하면
   * 모든 사각형을 건너뛰고 음식점 목록에 카페가 섞인다. 그래서 진행·결과 파일이 있는 폴더의 그룹이 다르면 거부한다.
   * - 기록이 없거나 깨졌는데(빈 파일 등) 진행·결과 파일이 있으면 #32 이전에 만든 음식점(FD6) 폴더로 본다.
   * - 기록만 있고 다른 파일이 없으면(키 오류로 첫 요청에서 멈춘 경우 등) 이번 그룹으로 다시 기록한다.
   */
  claimCategoryGroup(group: KakaoCategoryGroup): void {
    const hasData = this.paths
      .filter((path) => path !== this.categoryGroupPath)
      .some((path) => existsSync(path));
    const raw = existsSync(this.categoryGroupPath)
      ? readFileSync(this.categoryGroupPath, 'utf8').trim()
      : '';
    const recorded =
      KAKAO_CATEGORY_GROUPS.find((value) => value === raw) ??
      (hasData ? 'FD6' : null);
    if (hasData && recorded && recorded !== group)
      throw new Error(
        `출력 폴더 ${this.dir}는 ${recorded} 수집용입니다. ${group}는 다른 --out-dir로 수집하세요.`,
      );
    if (raw !== group)
      writeFileSync(this.categoryGroupPath, `${group}\n`, 'utf8');
  }

  ensureMenusCsv(): void {
    ensureCsv(this.menusPath, MENU_HEADER_LINE);
  }

  /** 끝난 검색 사각형. `leaf <rect>`는 결과를 다 받은 것, `split <rect>`는 4등분한 것. */
  completedRects(): Set<string> {
    return new Set(readLines(this.rectsPath));
  }

  markRect(entry: string): void {
    appendFileSync(this.rectsPath, `${entry}\n`, 'utf8');
  }

  /** 발견한 식당. 같은 ID는 처음 것만 남긴다. */
  discoveredPlaces(): Map<string, KakaoPlace> {
    const places = new Map<string, KakaoPlace>();
    for (const place of readJsonLines<KakaoPlace>(this.placesPath)) {
      if (place?.id && !places.has(place.id)) places.set(place.id, place);
    }
    return places;
  }

  addPlaces(places: KakaoPlace[]): void {
    if (!places.length) return;
    appendFileSync(
      this.placesPath,
      places.map((place) => `${JSON.stringify(place)}\n`).join(''),
      'utf8',
    );
  }

  /** 식당 CSV는 발견 목록에서 매번 새로 만든다. 중단돼도 반쯤 쓴 파일이 남지 않게 바꿔치기한다. */
  writeRestaurants(places: KakaoPlace[]): void {
    const tmp = `${this.restaurantsPath}.tmp`;
    writeFileSync(
      tmp,
      RESTAURANT_HEADER_LINE +
        places.map((place) => `${toRestaurantRow(place)}\r\n`).join(''),
      'utf8',
    );
    renameSync(tmp, this.restaurantsPath);
  }

  /**
   * 메뉴 수집이 끝난 장소 ID: 완료 목록(메뉴 없음·404 포함)과 메뉴 CSV에 행이 있는 곳.
   * 메뉴 행을 쓴 직후 완료 기록 전에 끊겨도 다시 수집하지 않는다.
   */
  menuDonePlaceIds(): Set<string> {
    const ids = new Set(readLines(this.menuDonePath));
    for (const line of readLines(this.menusPath).slice(1)) {
      const id = /,(\d+)$/.exec(line)?.[1];
      if (id) ids.add(id);
    }
    return ids;
  }

  /** 식당 하나의 행을 한 번에 덧붙여, 중단돼도 식당 단위로 끊기게 한다. */
  appendMenuRows(rows: string[]): void {
    if (!rows.length) return;
    appendFileSync(
      this.menusPath,
      rows.map((row) => `${row}\r\n`).join(''),
      'utf8',
    );
  }

  markMenuDone(placeId: string): void {
    appendFileSync(this.menuDonePath, `${placeId}\n`, 'utf8');
  }

  recordFailure(placeId: string, reason: string): void {
    appendFileSync(
      this.failedPath,
      `${JSON.stringify({ placeId, reason, at: new Date().toISOString() })}\n`,
      'utf8',
    );
  }
}

// ---- 수집 ----

export class KakaoPlaceCrawler {
  private readonly searchRequester: PoliteRequester;
  private readonly panelRequester: PoliteRequester;

  constructor(
    private readonly options: KakaoCrawlOptions,
    private readonly store: KakaoCrawlStore,
    private readonly deps: KakaoCrawlDeps,
  ) {
    // 카페(CE7)는 장소 목록만 모은다(#32 결정). 카페 제외 필터가 걸리면 전부 빠지므로 막는다.
    if (options.categoryGroup === 'CE7') {
      if (!options.discoverOnly)
        throw new Error('CE7(카페)은 장소 목록만 수집합니다(--discover-only).');
      if (options.excludedCategories.length)
        throw new Error('CE7(카페)에는 카테고리 제외 필터를 쓰지 않습니다.');
    }
    // 공식 API는 429·5xx와 형식이 맞지 않는 200 응답(중간 장비의 HTML 등)만 재시도한다.
    // 401·403(키·권한 문제) 등 나머지 4xx는 재시도해도 같아서 바로 멈춘다.
    this.searchRequester = new PoliteRequester(
      options.search,
      deps,
      (response) =>
        response.status === 429 ||
        response.status >= 500 ||
        (response.status === 200 && !isCategorySearch(response.body)),
    );
    // panel3는 없는 장소(404·410)만 재시도하지 않는다. 403(Restricted User Agent)·429·5xx는 물론
    // 400·401 등(헤더가 낡아 모두 거절되는 경우)과 JSON이 아닌 200 응답(차단 페이지)도 차단으로 보고
    // 재시도하며, 연속되면 실행을 멈춘다.
    this.panelRequester = new PoliteRequester(
      options.panel,
      deps,
      (response) =>
        response.status === 200
          ? parseJsonObject(response.body) === null
          : !GONE_STATUS.has(response.status),
    );
  }

  async run(): Promise<KakaoCrawlSummary> {
    const summary: KakaoCrawlSummary = {
      searchedRects: 0,
      truncatedRects: 0,
      failedRects: 0,
      discoveredPlaces: 0,
      restaurants: 0,
      excludedByCategory: 0,
      crawledPlaces: 0,
      skippedPlaces: 0,
      failedPlaces: 0,
      menuRows: 0,
      menuRowsWithPhoto: 0,
    };
    this.store.claimCategoryGroup(this.options.categoryGroup);
    const known = this.store.discoveredPlaces();
    const completed = this.store.completedRects();
    for (const rect of this.options.rects)
      await this.walk(rect, 0, completed, known, summary);
    // 일부만 받은 사각형은 재시작해도 알 수 있게 진행 파일에서 센다.
    summary.truncatedRects = [...this.store.completedRects()].filter((entry) =>
      entry.startsWith('truncated '),
    ).length;
    if (summary.failedRects)
      this.deps.log(
        `  경고: 검색 사각형 ${summary.failedRects}개가 실패해 식당 목록이 빠져 있을 수 있습니다. 같은 명령을 다시 실행하면 그 사각형만 다시 검색합니다.`,
      );
    const restaurants = [...known.values()].filter(
      (place) => !this.excludedCategory(place),
    );
    this.store.writeRestaurants(restaurants);
    summary.discoveredPlaces = known.size;
    summary.restaurants = restaurants.length;
    summary.excludedByCategory = known.size - restaurants.length;
    this.deps.log(
      `${this.options.categoryGroup === 'CE7' ? '카페' : '식당'} 목록: ${restaurants.length}곳 (발견 ${known.size}곳, 제외 카테고리 ${summary.excludedByCategory}곳)`,
    );
    if (this.options.discoverOnly) return summary;

    this.store.ensureMenusCsv();
    const done = this.store.menuDonePlaceIds();
    let pending = restaurants.filter((place) => !done.has(place.id));
    summary.skippedPlaces = restaurants.length - pending.length;
    if (this.options.maxPlaces > 0)
      pending = pending.slice(0, this.options.maxPlaces);
    this.deps.log(
      `메뉴 수집: 대상 ${pending.length}곳 (이미 수집 ${summary.skippedPlaces}곳 건너뜀)`,
    );

    let cursor = 0;
    const worker = async () => {
      while (cursor < pending.length && !this.panelRequester.stopped) {
        const place = pending[cursor];
        cursor += 1;
        const menus = await this.crawlPlace(place);
        // 다른 worker가 멈춤을 건 뒤 요청하지 못한 식당은 실패로 세지 않는다.
        if (menus === null && this.panelRequester.stopped) break;
        if (menus === null) summary.failedPlaces += 1;
        else {
          summary.crawledPlaces += 1;
          summary.menuRows += menus.length;
          summary.menuRowsWithPhoto += menus.filter(
            (menu) => menu.photoUrl,
          ).length;
        }
        if (cursor % 20 === 0)
          this.deps.log(`  진행 ${cursor}/${pending.length}`);
      }
    };
    await Promise.all(Array.from({ length: this.options.concurrency }, worker));
    if (this.panelRequester.stopped) {
      throw new BlockedError(
        `메뉴 요청이 연속 ${this.options.panel.maxConsecutiveBlocks}회 차단되어 멈췄습니다. 진행 상태는 저장됐고 같은 명령으로 이어서 실행할 수 있습니다.`,
      );
    }
    return summary;
  }

  /**
   * 사각형 안 식당이 45곳을 넘으면 4등분해 재귀로 검색한다.
   * 끝난 사각형은 기록해 재시작 때 요청하지 않는다. 실패한 사각형은 기록하지 않아 다음 실행에서 다시 한다.
   */
  private async walk(
    rect: Rect,
    depth: number,
    completed: Set<string>,
    known: Map<string, KakaoPlace>,
    summary: KakaoCrawlSummary,
  ): Promise<void> {
    const key = rectKey(rect);
    const children = splitRect(rect);
    // 깊이는 4등분만 센다. 긴 축 2등분은 정사각형으로 맞추는 단계라 --max-depth를 쓰지 않는다.
    const childDepth = depth + (children.length === 4 ? 1 : 0);
    if (completed.has(`leaf ${key}`)) return;
    if (completed.has(`split ${key}`)) {
      for (const child of children)
        await this.walk(child, childDepth, completed, known, summary);
      return;
    }

    let first = await this.search(rect, 1);
    if (!first) {
      summary.failedRects += 1;
      return;
    }
    const splittable =
      childDepth <= this.options.maxDepth &&
      children.every(
        ([cx1, cy1, cx2, cy2]) =>
          Math.min(cx2 - cx1, cy2 - cy1) >= MIN_SPLIT_DEG,
      );
    if (first.totalCount > SEARCH_RESULT_LIMIT && splittable) {
      this.store.markRect(`split ${key}`);
      for (const child of children)
        await this.walk(child, childDepth, completed, known, summary);
      return;
    }
    // 더 나눌 수 없으면 넓히지 않은 사각형으로 다시 받아, 여백의 이웃 장소가 45곳 자리를 차지하지 않게 한다.
    const truncated = first.totalCount > SEARCH_RESULT_LIMIT;
    const expand = !truncated;
    if (truncated) {
      first = await this.search(rect, 1, expand);
      if (!first) {
        summary.failedRects += 1;
        return;
      }
    }
    const places = [...first.places];
    let isEnd = first.isEnd;
    for (
      let page = 2;
      !isEnd && page <= SEARCH_RESULT_LIMIT / SEARCH_PAGE_SIZE;
      page += 1
    ) {
      const next = await this.search(rect, page, expand);
      if (!next) {
        summary.failedRects += 1;
        return;
      }
      places.push(...next.places);
      isEnd = next.isEnd;
    }
    // 쪽을 모두 받은 뒤에 기록해, 중간에 실패해 다시 검색할 때 truncated가 두 번 세지지 않게 한다.
    if (truncated) {
      this.store.markRect(`truncated ${key}`);
      this.deps.log(
        `  더 나눌 수 없는 사각형(최대 깊이·최소 폭)에서도 ${first.totalCount}곳이라 ${SEARCH_RESULT_LIMIT}곳만 받습니다: ${key}`,
      );
    }

    const fresh = places
      .filter((place) => this.inDistrict(place))
      .filter((place) => !known.has(place.id));
    fresh.forEach((place) => known.set(place.id, place));
    this.store.addPlaces(fresh);
    this.store.markRect(`leaf ${key}`);
    summary.searchedRects += 1;
    if (summary.searchedRects % 50 === 0)
      this.deps.log(
        `  검색 사각형 ${summary.searchedRects}개, 누적 ${known.size}곳`,
      );
  }

  /** 카테고리 검색 한 쪽. 재시도를 소진하면 null, 키·권한·요청 오류(4xx)면 실행을 멈춘다. */
  private async search(rect: Rect, page: number, expand = true) {
    const response = await this.searchRequester.get(
      categorySearchUrl(rect, page, this.options.categoryGroup, expand),
      { Authorization: `KakaoAK ${this.options.restApiKey}` },
    );
    if (this.searchRequester.stopped)
      throw new BlockedError(
        `카카오 로컬 API가 연속 ${this.options.search.maxConsecutiveBlocks}회 실패해 멈췄습니다. 같은 명령으로 이어서 실행할 수 있습니다.`,
      );
    if (!response) return null;
    if (response.status !== 200) {
      // 응답 본문은 카카오 오류 메시지(JSON)이고 키를 담지 않는다.
      throw new Error(
        `카카오 로컬 API 오류 HTTP ${response.status}: ${response.body.slice(0, 200)}`,
      );
    }
    return parseCategorySearch(response.body);
  }

  private excludedCategory(place: KakaoPlace): boolean {
    return this.options.excludedCategories.some((word) =>
      place.category.includes(word),
    );
  }

  private inDistrict(place: KakaoPlace): boolean {
    return (
      !this.options.district || place.address.includes(this.options.district)
    );
  }

  /** 수집한 메뉴, 실패면 null. */
  private async crawlPlace(place: KakaoPlace): Promise<KakaoMenu[] | null> {
    const response = await this.panelRequester.get(panelUrl(place.id), {
      pf: 'web',
      appVersion: this.options.appVersion,
      Referer: 'https://place.map.kakao.com/',
    });
    if (response === null) {
      if (!this.panelRequester.stopped)
        this.store.recordFailure(place.id, 'request-failed');
      return null;
    }
    if (response.status !== 200) {
      // 없는 장소(404·410, 폐업 등)는 다시 요청해도 같으므로 완료로 남긴다.
      this.store.recordFailure(place.id, `http-${response.status}`);
      this.store.markMenuDone(place.id);
      return null;
    }
    const json = parseJsonObject(response.body);
    const menus = json ? parsePanelMenus(json) : [];
    this.store.appendMenuRows(toMenuRows(place.id, menus));
    this.store.markMenuDone(place.id);
    return menus;
  }
}

export type { HttpFetcher };
