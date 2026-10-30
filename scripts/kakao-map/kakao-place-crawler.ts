import { appendFileSync, renameSync, writeFileSync } from 'fs';
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
  DEFAULT_RETRYABLE_STATUS,
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

/** 경도·위도 사각형 [x1, y1, x2, y2] (왼쪽 아래, 오른쪽 위). */
export type Rect = [number, number, number, number];

/** 카테고리 검색 한 번에 받을 수 있는 최대 결과 수(15개 × 3쪽). */
export const SEARCH_RESULT_LIMIT = 45;
const SEARCH_PAGE_SIZE = 15;

export interface KakaoCrawlOptions {
  restApiKey: string;
  rect: Rect;
  /** 주소에 이 문자열이 있는 식당만 남긴다. 빈 문자열이면 거르지 않는다. */
  district: string;
  /** 사각형을 4등분하는 최대 깊이. 이 깊이에서도 45곳을 넘으면 45곳만 받는다. */
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
  /** 최대 깊이에서도 45곳을 넘어 일부만 받은 사각형 수. */
  truncatedRects: number;
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

export function categorySearchUrl(rect: Rect, page: number): string {
  const params = new URLSearchParams({
    category_group_code: 'FD6',
    rect: rectKey(rect),
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

  constructor(readonly dir: string) {
    this.restaurantsPath = join(dir, 'restaurants.csv');
    this.menusPath = join(dir, 'menus.csv');
    this.placesPath = join(dir, 'places.jsonl');
    this.rectsPath = join(dir, 'search-rects.txt');
    this.menuDonePath = join(dir, 'menu-done.txt');
    this.failedPath = join(dir, 'failed.jsonl');
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
    ];
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
    // 공식 API는 429·5xx만 재시도한다. 401·403(키·권한 문제)은 재시도해도 같아서 바로 멈춘다.
    this.searchRequester = new PoliteRequester(
      options.search,
      deps,
      (response) => response.status === 429 || response.status >= 500,
    );
    // panel3는 403(Restricted User Agent)·429·5xx와 JSON이 아닌 200 응답(차단 페이지)을 차단으로 본다.
    this.panelRequester = new PoliteRequester(
      options.panel,
      deps,
      (response) =>
        DEFAULT_RETRYABLE_STATUS.has(response.status) ||
        (response.status === 200 && parseJsonObject(response.body) === null),
    );
  }

  async run(): Promise<KakaoCrawlSummary> {
    const summary: KakaoCrawlSummary = {
      searchedRects: 0,
      truncatedRects: 0,
      discoveredPlaces: 0,
      restaurants: 0,
      excludedByCategory: 0,
      crawledPlaces: 0,
      skippedPlaces: 0,
      failedPlaces: 0,
      menuRows: 0,
      menuRowsWithPhoto: 0,
    };
    const known = this.store.discoveredPlaces();
    await this.walk(
      this.options.rect,
      0,
      this.store.completedRects(),
      known,
      summary,
    );
    const restaurants = [...known.values()].filter(
      (place) => !this.excludedCategory(place),
    );
    this.store.writeRestaurants(restaurants);
    summary.discoveredPlaces = known.size;
    summary.restaurants = restaurants.length;
    summary.excludedByCategory = known.size - restaurants.length;
    this.deps.log(
      `식당 목록: ${restaurants.length}곳 (발견 ${known.size}곳, 제외 카테고리 ${summary.excludedByCategory}곳)`,
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
    const workers = Math.max(
      1,
      Math.min(2, Math.floor(this.options.concurrency)),
    );
    await Promise.all(Array.from({ length: workers }, worker));
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
    if (completed.has(`leaf ${key}`)) return;
    if (completed.has(`split ${key}`)) {
      for (const child of quarters(rect))
        await this.walk(child, depth + 1, completed, known, summary);
      return;
    }

    const first = await this.search(rect, 1);
    if (!first) return;
    if (
      first.totalCount > SEARCH_RESULT_LIMIT &&
      depth < this.options.maxDepth
    ) {
      this.store.markRect(`split ${key}`);
      for (const child of quarters(rect))
        await this.walk(child, depth + 1, completed, known, summary);
      return;
    }
    if (first.totalCount > SEARCH_RESULT_LIMIT) {
      summary.truncatedRects += 1;
      this.deps.log(
        `  최대 깊이에서도 ${first.totalCount}곳이라 ${SEARCH_RESULT_LIMIT}곳만 받습니다: ${key}`,
      );
    }
    const places = [...first.places];
    let isEnd = first.isEnd;
    for (
      let page = 2;
      !isEnd && page <= SEARCH_RESULT_LIMIT / SEARCH_PAGE_SIZE;
      page += 1
    ) {
      const next = await this.search(rect, page);
      if (!next) return;
      places.push(...next.places);
      isEnd = next.isEnd;
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
  private async search(rect: Rect, page: number) {
    const response = await this.searchRequester.get(
      categorySearchUrl(rect, page),
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
      // 없는 장소(폐업 등)는 다시 요청해도 같으므로 완료로 남긴다.
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
