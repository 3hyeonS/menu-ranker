import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import {
  looksBlocked,
  parseMenuPage,
  parseRestaurantList,
  PlaceMenu,
  PlaceSummary,
} from './naver-place-parser';

export const CSV_HEADERS = [
  'place_id',
  '식당명',
  '주소',
  '카테고리',
  '메뉴명',
  '가격',
  '사진URL',
] as const;

export interface HttpResponse {
  status: number;
  body: string;
}

/** 실제 구현은 fetch, 테스트는 픽스처를 돌려주는 Fake를 쓴다. */
export interface HttpFetcher {
  get(url: string): Promise<HttpResponse>;
}

export interface CrawlOptions {
  areas: string[];
  keywords: string[];
  /** 검색 좌표 기준점(경도 x, 위도 y). */
  center: { x: number; y: number };
  /** 주소에 이 문자열이 있는 식당만 남긴다. 빈 문자열이면 거르지 않는다. */
  district: string;
  maxPages: number;
  pageSize: number;
  minDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
  backoffBaseMs: number;
  /** 연속으로 이만큼 차단(재시도 소진)되면 전체 실행을 멈춘다. */
  maxConsecutiveBlocks: number;
  concurrency: number;
  /** 이번 실행에서 메뉴를 수집할 최대 식당 수(시험 실행용). 0이면 제한 없음. */
  maxPlaces: number;
  /** true면 식당 목록만 모으고 메뉴 수집은 하지 않는다. */
  discoverOnly: boolean;
}

export interface CrawlDeps {
  fetcher: HttpFetcher;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  log: (message: string) => void;
}

export interface CrawlSummary {
  discoveredPlaces: number;
  crawledPlaces: number;
  skippedPlaces: number;
  failedPlaces: number;
  menuRows: number;
}

export class BlockedError extends Error {}

const BASE_URL = 'https://pcmap.place.naver.com';

export function restaurantListUrl(
  query: string,
  page: number,
  options: Pick<CrawlOptions, 'center' | 'pageSize'>,
): string {
  const params = new URLSearchParams({
    query,
    x: String(options.center.x),
    y: String(options.center.y),
    display: String(options.pageSize),
    start: String((page - 1) * options.pageSize + 1),
  });
  return `${BASE_URL}/restaurant/list?${params.toString()}`;
}

export function menuPageUrl(placeId: string): string {
  return `${BASE_URL}/restaurant/${placeId}/menu/list`;
}

// ---- CSV ----

function csvField(value: string): string {
  const flat = value.replace(/[\r\n]+/g, ' ');
  return /[",]/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
}

/** 메뉴 1개당 1행. 메뉴가 없으면 메뉴 칸을 비운 1행. */
export function toCsvRows(place: PlaceSummary, menus: PlaceMenu[]): string[] {
  const head = [place.placeId, place.name, place.address, place.category];
  const items = menus.length ? menus : [{ name: '', price: '', imageUrl: '' }];
  return items.map((menu) =>
    [...head, menu.name, menu.price, menu.imageUrl].map(csvField).join(','),
  );
}

// ---- 진행 상태 파일 (출력 CSV 옆) ----

const CSV_HEADER_LINE = `\uFEFF${CSV_HEADERS.join(',')}\r\n`;

export class CrawlStore {
  readonly queriesPath: string;
  readonly placesPath: string;
  readonly failedPath: string;
  readonly excludedPath: string;

  constructor(readonly csvPath: string) {
    this.queriesPath = `${csvPath}.queries.txt`;
    this.placesPath = `${csvPath}.places.jsonl`;
    this.failedPath = `${csvPath}.failed.jsonl`;
    this.excludedPath = `${csvPath}.excluded.txt`;
  }

  /** 이 저장소가 쓰는 모든 파일 경로. */
  get paths(): string[] {
    return [
      this.csvPath,
      this.queriesPath,
      this.placesPath,
      this.failedPath,
      this.excludedPath,
    ];
  }

  /**
   * Excel에서 바로 열리도록 UTF-8(BOM) + CRLF. 이미 있으면 중단으로 잘린 마지막 줄만 지운다.
   * 행은 항상 줄바꿈으로 끝나므로, 파일이 줄바꿈으로 끝나지 않으면 마지막 줄이 덜 쓰인 것이다.
   * (다른 도구가 LF로 저장해도 지우지 않도록 `\n`으로 판단한다.)
   */
  ensureCsv(): void {
    if (!existsSync(this.csvPath)) {
      writeFileSync(this.csvPath, CSV_HEADER_LINE, 'utf8');
      return;
    }
    const content = readFileSync(this.csvPath, 'utf8');
    if (content.endsWith('\n')) return;
    const lastLineEnd = content.lastIndexOf('\n');
    // 줄바꿈이 하나도 없으면 헤더조차 덜 쓰인 것이므로 헤더를 다시 쓴다.
    writeFileSync(
      this.csvPath,
      lastLineEnd < 0 ? CSV_HEADER_LINE : content.slice(0, lastLineEnd + 1),
      'utf8',
    );
  }

  completedQueries(): Set<string> {
    return new Set(readLines(this.queriesPath));
  }

  markQueryDone(queryKey: string): void {
    appendFileSync(this.queriesPath, `${queryKey}\n`, 'utf8');
  }

  /** 발견한 식당. 같은 place_id는 처음 것만 남긴다. */
  discoveredPlaces(): Map<string, PlaceSummary> {
    const places = new Map<string, PlaceSummary>();
    for (const line of readLines(this.placesPath)) {
      let place: PlaceSummary;
      try {
        place = JSON.parse(line) as PlaceSummary;
      } catch {
        continue; // 중단으로 덜 쓰인 줄
      }
      if (place?.placeId && !places.has(place.placeId))
        places.set(place.placeId, place);
    }
    return places;
  }

  addPlaces(places: PlaceSummary[]): void {
    if (!places.length) return;
    appendFileSync(
      this.placesPath,
      places.map((place) => `${JSON.stringify(place)}\n`).join(''),
      'utf8',
    );
  }

  /**
   * 다시 수집하지 않을 place_id: CSV에 행이 있거나, 지역 밖·없는 페이지(404 등)로 제외된 곳.
   * 값의 줄바꿈은 공백으로 바꿔 쓰므로 한 줄이 한 행이다.
   */
  crawledPlaceIds(): Set<string> {
    const ids = new Set(readLines(this.excludedPath));
    for (const line of readLines(this.csvPath).slice(1)) {
      const id = /^(\d+),/.exec(line)?.[1];
      if (id) ids.add(id);
    }
    return ids;
  }

  /** 식당 하나의 행을 한 번에 덧붙여, 중단돼도 식당 단위로 끊기게 한다. */
  appendPlaceRows(rows: string[]): void {
    appendFileSync(
      this.csvPath,
      rows.map((row) => `${row}\r\n`).join(''),
      'utf8',
    );
  }

  markExcluded(placeId: string): void {
    appendFileSync(this.excludedPath, `${placeId}\n`, 'utf8');
  }

  recordFailure(placeId: string, reason: string): void {
    appendFileSync(
      this.failedPath,
      `${JSON.stringify({ placeId, reason, at: new Date().toISOString() })}\n`,
      'utf8',
    );
  }
}

function readLines(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
}

// ---- 요청 ----

const RETRYABLE_STATUS = new Set([403, 429, 500, 502, 503, 504]);

export class NaverPlaceCrawler {
  private consecutiveBlocks = 0;
  private stopped = false;

  constructor(
    private readonly options: CrawlOptions,
    private readonly store: CrawlStore,
    private readonly deps: CrawlDeps,
  ) {}

  async run(): Promise<CrawlSummary> {
    this.store.ensureCsv();
    const places = await this.discover();
    const summary: CrawlSummary = {
      discoveredPlaces: places.size,
      crawledPlaces: 0,
      skippedPlaces: 0,
      failedPlaces: 0,
      menuRows: 0,
    };
    if (this.options.discoverOnly) return summary;

    const done = this.store.crawledPlaceIds();
    let pending = [...places.values()].filter(
      (place) => !done.has(place.placeId),
    );
    summary.skippedPlaces = places.size - pending.length;
    if (this.options.maxPlaces > 0)
      pending = pending.slice(0, this.options.maxPlaces);
    this.deps.log(
      `메뉴 수집: 대상 ${pending.length}곳 (이미 수집 ${summary.skippedPlaces}곳 건너뜀)`,
    );

    let cursor = 0;
    const worker = async () => {
      while (cursor < pending.length && !this.stopped) {
        const place = pending[cursor];
        cursor += 1;
        const rows = await this.crawlPlace(place);
        // 다른 worker가 멈춤을 건 뒤 요청하지 못한 식당은 실패로 세지 않는다.
        if (rows === null && this.stopped) break;
        if (rows === null) summary.failedPlaces += 1;
        else {
          summary.crawledPlaces += 1;
          summary.menuRows += rows;
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
    if (this.stopped) {
      throw new BlockedError(
        `연속 ${this.options.maxConsecutiveBlocks}회 차단되어 멈췄습니다. 진행 상태는 저장됐고 같은 명령으로 이어서 실행할 수 있습니다.`,
      );
    }
    return summary;
  }

  /** 지역 × 키워드 검색으로 place_id를 모은다. 끝난 검색은 기록해 재시작 때 건너뛴다. */
  private async discover(): Promise<Map<string, PlaceSummary>> {
    const completed = this.store.completedQueries();
    const known = this.store.discoveredPlaces();
    for (const area of this.options.areas) {
      for (const keyword of this.options.keywords) {
        const query = `${area} ${keyword}`.trim();
        const queryKey = `${query}|pages=${this.options.maxPages}|size=${this.options.pageSize}|district=${this.options.district}`;
        if (completed.has(queryKey)) continue;
        let added = 0;
        let failed = false;
        const seenInQuery = new Set<string>();
        for (let page = 1; page <= this.options.maxPages; page += 1) {
          const response = await this.request(
            restaurantListUrl(query, page, this.options),
          );
          if (this.stopped)
            throw new BlockedError('식당 목록 검색 중 차단되어 멈췄습니다.');
          if (response?.status !== 200) {
            failed = true;
            break;
          }
          let listed: PlaceSummary[];
          try {
            listed = parseRestaurantList(response.body);
          } catch (error) {
            this.deps.log(`  목록 파싱 실패: ${(error as Error).message}`);
            failed = true;
            break;
          }
          // 결과가 없거나 앞 쪽과 같은 결과만 오면(쪽 넘김 미지원·끝) 멈춘다.
          // 다른 검색에서 이미 찾은 식당만 있는 쪽이어도 다음 쪽은 계속 본다.
          const unseen = listed.filter(
            (place) => !seenInQuery.has(place.placeId),
          );
          if (!unseen.length) break;
          unseen.forEach((place) => seenInQuery.add(place.placeId));
          const fresh = unseen
            .filter((place) => this.inDistrict(place))
            .filter((place) => !known.has(place.placeId));
          fresh.forEach((place) => known.set(place.placeId, place));
          this.store.addPlaces(fresh);
          added += fresh.length;
          // 한 쪽을 다 채우지 못했으면 마지막 쪽이다.
          if (listed.length < this.options.pageSize) break;
        }
        // 실패한 검색은 완료로 기록하지 않아 다음 실행에서 다시 한다.
        if (!failed) this.store.markQueryDone(queryKey);
        this.deps.log(
          `검색 "${query}": 새 식당 ${added}곳 (누적 ${known.size}곳)${failed ? ', 실패-재시도 대상' : ''}`,
        );
      }
    }
    return known;
  }

  private inDistrict(place: PlaceSummary): boolean {
    return (
      !this.options.district ||
      !place.address ||
      place.address.includes(this.options.district)
    );
  }

  /** 수집한 메뉴 행 수, 실패면 null. */
  private async crawlPlace(place: PlaceSummary): Promise<number | null> {
    const response = await this.request(menuPageUrl(place.placeId));
    if (response === null) {
      if (!this.stopped)
        this.store.recordFailure(place.placeId, 'request-failed');
      return null;
    }
    if (response.status !== 200) {
      // 없는 페이지(폐업 등)는 다시 요청해도 같으므로 제외 목록에 남긴다.
      this.store.recordFailure(place.placeId, `http-${response.status}`);
      this.store.markExcluded(place.placeId);
      return null;
    }
    try {
      const page = parseMenuPage(response.body, place.placeId);
      const merged: PlaceSummary = {
        placeId: place.placeId,
        name: place.name || page.place?.name || '',
        address: place.address || page.place?.address || '',
        category: place.category || page.place?.category || '',
      };
      // 목록에 주소가 없어 통과한 식당은 메뉴 페이지 주소로 다시 거른다.
      if (!this.inDistrict(merged)) {
        this.store.markExcluded(place.placeId);
        this.deps.log(`  지역 밖 제외: ${merged.name} (${merged.address})`);
        return 0;
      }
      this.store.appendPlaceRows(toCsvRows(merged, page.menus));
      return page.menus.length;
    } catch (error) {
      this.store.recordFailure(
        place.placeId,
        `parse: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * 지연·재시도·백오프를 적용한 GET. 정상(200)이나 재시도하지 않는 상태(404 등)는 응답을,
   * 재시도를 소진했거나 멈춘 상태면 null을 돌려준다.
   */
  private async request(url: string): Promise<HttpResponse | null> {
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      if (this.stopped) return null;
      await this.deps.sleep(this.politeDelay());
      let response: HttpResponse;
      try {
        response = await this.deps.fetcher.get(url);
      } catch (error) {
        this.deps.log(
          `  요청 오류(${attempt + 1}회): ${(error as Error).message} ${url}`,
        );
        if (attempt < this.options.maxRetries)
          await this.deps.sleep(this.backoff(attempt));
        continue;
      }
      const blocked =
        RETRYABLE_STATUS.has(response.status) ||
        (response.status === 200 && looksBlocked(response.body));
      if (response.status === 200 && !blocked) {
        this.consecutiveBlocks = 0;
        return response;
      }
      if (!blocked) {
        this.deps.log(`  HTTP ${response.status}, 건너뜀: ${url}`);
        return response;
      }
      this.deps.log(
        `  차단/오류 응답 ${response.status}(${attempt + 1}회): ${url}`,
      );
      if (attempt < this.options.maxRetries)
        await this.deps.sleep(this.backoff(attempt));
    }
    this.consecutiveBlocks += 1;
    if (this.consecutiveBlocks >= this.options.maxConsecutiveBlocks)
      this.stopped = true;
    return null;
  }

  private politeDelay(): number {
    const { minDelayMs, maxDelayMs } = this.options;
    return (
      minDelayMs + this.deps.random() * Math.max(0, maxDelayMs - minDelayMs)
    );
  }

  private backoff(attempt: number): number {
    const base = this.options.backoffBaseMs * 2 ** attempt;
    return base + this.deps.random() * base * 0.5;
  }
}
