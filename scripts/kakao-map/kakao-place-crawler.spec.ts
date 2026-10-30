import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BlockedError,
  HttpFetcher,
  HttpResponse,
} from '../crawl-common/polite-requester';
import {
  categorySearchUrl,
  KakaoCrawlOptions,
  KakaoCrawlStore,
  KakaoPlaceCrawler,
  panelUrl,
  Rect,
} from './kakao-place-crawler';
import { parseCategorySearch, parsePanelMenus } from './kakao-place-parser';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

const RECT: Rect = [127, 37, 127.2, 37.2];

const POLICY = {
  minDelayMs: 1000,
  maxDelayMs: 3000,
  maxRetries: 2,
  backoffBaseMs: 10000,
  maxConsecutiveBlocks: 2,
};

const OPTIONS: KakaoCrawlOptions = {
  restApiKey: 'test-key',
  rect: RECT,
  district: '송파구',
  maxDepth: 3,
  excludedCategories: ['술집'],
  search: { ...POLICY, minDelayMs: 0, maxDelayMs: 0 },
  panel: POLICY,
  appVersion: '6.6.0',
  concurrency: 1,
  maxPlaces: 0,
  discoverOnly: false,
};

class FakeFetcher implements HttpFetcher {
  readonly calls: string[] = [];
  readonly headers: Array<Record<string, string> | undefined> = [];

  constructor(
    private readonly routes: Record<string, Array<HttpResponse | Error>>,
  ) {}

  async get(
    url: string,
    headers?: Record<string, string>,
  ): Promise<HttpResponse> {
    this.calls.push(url);
    this.headers.push(headers);
    const queue = this.routes[url];
    if (!queue?.length) return { status: 404, body: '' };
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return next;
  }
}

const ok = (name: string): HttpResponse => ({
  status: 200,
  body: fixture(name),
});

// 검색 결과를 테스트 안에서 직접 만든다.
const searchPage = (
  totalCount: number,
  ids: string[],
  isEnd = true,
): HttpResponse => ({
  status: 200,
  body: JSON.stringify({
    meta: {
      total_count: totalCount,
      pageable_count: totalCount,
      is_end: isEnd,
    },
    documents: ids.map((id) => ({
      id,
      place_name: `식당${id}`,
      category_name: '음식점 > 한식',
      road_address_name: `서울 송파구 가상로 ${id}`,
      address_name: '',
    })),
  }),
});

const quarters = ([x1, y1, x2, y2]: Rect): Rect[] => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return [
    [x1, y1, mx, my],
    [mx, y1, x2, my],
    [x1, my, mx, y2],
    [mx, my, x2, y2],
  ];
};

describe('KakaoPlaceCrawler', () => {
  let dir: string;
  let store: KakaoCrawlStore;
  let sleeps: number[];

  const crawler = (
    fetcher: HttpFetcher,
    options: Partial<KakaoCrawlOptions> = {},
  ) =>
    new KakaoPlaceCrawler({ ...OPTIONS, ...options }, store, {
      fetcher,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0.5,
      log: () => undefined,
    });

  const lines = (path: string) =>
    readFileSync(path, 'utf8').split('\r\n').filter(Boolean);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kakao-crawl-'));
    store = new KakaoCrawlStore(dir);
    sleeps = [];
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('송파구 식당만 식당 CSV에, 메뉴는 메뉴 1개당 1행으로 메뉴 CSV에 쓴다', async () => {
    const fetcher = new FakeFetcher({
      [categorySearchUrl(RECT, 1)]: [ok('category-search.json')],
      [panelUrl('1000001')]: [ok('panel-menus.json')],
      [panelUrl('1000002')]: [ok('panel-no-menu.json')],
    });

    const summary = await crawler(fetcher).run();

    expect(summary).toEqual({
      searchedRects: 1,
      truncatedRects: 0,
      discoveredPlaces: 3,
      restaurants: 2,
      excludedByCategory: 1,
      crawledPlaces: 2,
      skippedPlaces: 0,
      failedPlaces: 0,
      menuRows: 2,
      menuRowsWithPhoto: 1,
    });
    // 강남구(1000004)는 버리고, 술집(1000003)은 메뉴를 요청하지 않는다.
    expect(fetcher.calls).not.toContain(panelUrl('1000003'));
    expect(fetcher.calls).not.toContain(panelUrl('1000004'));
    expect(lines(store.restaurantsPath)).toEqual([
      '﻿장소id,식당명,주소',
      '1000001,가상 고기집,서울 송파구 가상로 1',
      '1000002,"가상 ""초밥"", 송파점",서울 송파구 송파동 2-2',
    ]);
    expect(lines(store.menusPath)).toEqual([
      '﻿메뉴명,사진URL,식당id',
      '생 갈매기,http://t1.kakaocdn.net/mystore/FAKE0001,1000001',
      '"된장찌개, 공기밥",,1000001',
    ]);
    expect(sleeps.every((ms) => ms === 0 || ms === 2000)).toBe(true);
  });

  it('로컬 API에는 REST API 키를, panel3에는 pf·appVersion·Referer 헤더를 보낸다', async () => {
    const fetcher = new FakeFetcher({
      [categorySearchUrl(RECT, 1)]: [searchPage(1, ['1'])],
      [panelUrl('1')]: [ok('panel-no-menu.json')],
    });
    await crawler(fetcher).run();
    expect(fetcher.headers).toEqual([
      { Authorization: 'KakaoAK test-key' },
      {
        pf: 'web',
        appVersion: '6.6.0',
        Referer: 'https://place.map.kakao.com/',
      },
    ]);
  });

  it('45곳을 넘는 사각형은 4등분해 검색하고, 다시 실행하면 끝난 사각형을 요청하지 않는다', async () => {
    const children = quarters(RECT);
    const fetcher = new FakeFetcher({
      [categorySearchUrl(RECT, 1)]: [searchPage(60, [])],
      [categorySearchUrl(children[0], 1)]: [searchPage(1, ['1'])],
      [categorySearchUrl(children[1], 1)]: [searchPage(1, ['2'])],
      [categorySearchUrl(children[2], 1)]: [searchPage(0, [])],
      [categorySearchUrl(children[3], 1)]: [searchPage(1, ['1'])],
    });

    const summary = await crawler(fetcher, { discoverOnly: true }).run();

    expect(summary).toMatchObject({ searchedRects: 4, discoveredPlaces: 2 });
    expect(fetcher.calls).toHaveLength(5);

    const second = new FakeFetcher({});
    await crawler(second, { discoverOnly: true }).run();
    expect(second.calls).toEqual([]);
    expect(lines(store.restaurantsPath)).toHaveLength(1 + 2);
  });

  it('결과가 여러 쪽이면 is_end까지 쪽을 넘긴다', async () => {
    const fetcher = new FakeFetcher({
      [categorySearchUrl(RECT, 1)]: [searchPage(20, ['1', '2'], false)],
      [categorySearchUrl(RECT, 2)]: [searchPage(20, ['3'], true)],
    });
    const summary = await crawler(fetcher, { discoverOnly: true }).run();
    expect(summary.discoveredPlaces).toBe(3);
    expect(fetcher.calls).toHaveLength(2);
  });

  it('최대 깊이에서도 45곳을 넘으면 받을 수 있는 만큼만 받고 개수를 센다', async () => {
    const fetcher = new FakeFetcher({
      [categorySearchUrl(RECT, 1)]: [searchPage(50, ['1'], false)],
      [categorySearchUrl(RECT, 2)]: [searchPage(50, ['2'], false)],
      [categorySearchUrl(RECT, 3)]: [searchPage(50, ['3'], false)],
    });
    const summary = await crawler(fetcher, {
      maxDepth: 0,
      discoverOnly: true,
    }).run();
    expect(summary).toMatchObject({ truncatedRects: 1, discoveredPlaces: 3 });
    // 4쪽은 카카오가 주지 않으므로 요청하지 않는다
    expect(fetcher.calls).toHaveLength(3);
  });

  it('로컬 API가 401(키 오류)이면 재시도 없이 멈추고 사각형을 완료로 남기지 않는다', async () => {
    const fetcher = new FakeFetcher({
      [categorySearchUrl(RECT, 1)]: [
        { status: 401, body: '{"errorType":"AccessDeniedError"}' },
      ],
    });
    await expect(crawler(fetcher).run()).rejects.toThrow('HTTP 401');
    expect(fetcher.calls).toHaveLength(1);
    expect(store.completedRects().size).toBe(0);
  });

  it('로컬 API 429는 백오프 후 재시도한다', async () => {
    const fetcher = new FakeFetcher({
      [categorySearchUrl(RECT, 1)]: [
        { status: 429, body: '' },
        searchPage(1, ['1']),
      ],
    });
    const summary = await crawler(fetcher, { discoverOnly: true }).run();
    expect(summary.discoveredPlaces).toBe(1);
    expect(sleeps).toContain(12500);
  });

  it('panel3가 연속 차단(403·JSON 아닌 200)되면 멈추고, 다음 실행에서 남은 식당부터 이어간다', async () => {
    const search = {
      [categorySearchUrl(RECT, 1)]: [searchPage(2, ['1', '2'])],
    };
    const first = new FakeFetcher({
      ...search,
      [panelUrl('1')]: [{ status: 403, body: 'Restricted User Agent' }],
      [panelUrl('2')]: [{ status: 200, body: '<html>차단</html>' }],
    });

    await expect(crawler(first).run()).rejects.toBeInstanceOf(BlockedError);
    expect(first.calls.filter((url) => url === panelUrl('1'))).toHaveLength(
      1 + POLICY.maxRetries,
    );
    expect(readFileSync(store.failedPath, 'utf8')).toContain('request-failed');

    const second = new FakeFetcher({
      [panelUrl('1')]: [ok('panel-menus.json')],
      [panelUrl('2')]: [ok('panel-no-menu.json')],
    });
    const summary = await crawler(second).run();
    expect(second.calls).toEqual([panelUrl('1'), panelUrl('2')]);
    expect(summary).toMatchObject({ crawledPlaces: 2, failedPlaces: 0 });
  });

  it('메뉴가 없는 식당과 없는 장소(404)는 완료로 남겨 다시 요청하지 않는다', async () => {
    await crawler(
      new FakeFetcher({
        [categorySearchUrl(RECT, 1)]: [searchPage(2, ['1', '2'])],
        [panelUrl('1')]: [ok('panel-no-menu.json')],
      }),
    ).run();
    expect(readFileSync(store.failedPath, 'utf8')).toContain('http-404');

    const second = new FakeFetcher({});
    const summary = await crawler(second).run();
    expect(second.calls).toEqual([]);
    expect(summary.skippedPlaces).toBe(2);
  });

  it('메뉴 행을 쓰고 완료 기록 전에 끊긴 식당도 다시 수집하지 않고, 잘린 마지막 줄은 지운다', async () => {
    writeFileSync(
      store.placesPath,
      `${JSON.stringify({ id: '1', name: 'a', address: '서울 송파구 a', category: '' })}\n` +
        `${JSON.stringify({ id: '2', name: 'b', address: '서울 송파구 b', category: '' })}\n{"id":"3`,
    );
    writeFileSync(
      store.rectsPath,
      `leaf ${RECT.map((v) => v.toFixed(6)).join(',')}\n`,
    );
    writeFileSync(
      store.menusPath,
      '﻿메뉴명,사진URL,식당id\r\n김밥,,1\r\n라면,,2',
    );
    const fetcher = new FakeFetcher({
      [panelUrl('2')]: [ok('panel-no-menu.json')],
    });

    const summary = await crawler(fetcher).run();

    expect(fetcher.calls).toEqual([panelUrl('2')]);
    expect(summary).toMatchObject({ discoveredPlaces: 2, crawledPlaces: 1 });
    expect(lines(store.menusPath)).toEqual([
      '﻿메뉴명,사진URL,식당id',
      '김밥,,1',
    ]);
  });

  it('--max-places만큼만 메뉴를 수집한다', async () => {
    const fetcher = new FakeFetcher({
      [categorySearchUrl(RECT, 1)]: [searchPage(2, ['1', '2'])],
      [panelUrl('1')]: [ok('panel-no-menu.json')],
    });
    const summary = await crawler(fetcher, { maxPlaces: 1 }).run();
    expect(summary.crawledPlaces).toBe(1);
    expect(fetcher.calls).not.toContain(panelUrl('2'));
  });
});

describe('kakao-place-parser', () => {
  it('카테고리 검색: 도로명 주소가 없으면 지번 주소를 쓴다', () => {
    const page = parseCategorySearch(fixture('category-search.json'));
    expect(page.totalCount).toBe(4);
    expect(page.isEnd).toBe(true);
    expect(page.places[1]).toEqual({
      id: '1000002',
      name: '가상 "초밥", 송파점',
      address: '서울 송파구 송파동 2-2',
      category: '음식점 > 일식',
    });
  });

  it('카테고리 검색 형식이 아니면 오류', () => {
    expect(() => parseCategorySearch('{"errorType":"x"}')).toThrow();
  });

  it('panel3: 메뉴 이름 없는 항목은 빼고 블로그 사진(menus.photos)은 쓰지 않는다', () => {
    const menus = parsePanelMenus(JSON.parse(fixture('panel-menus.json')));
    expect(menus).toEqual([
      {
        name: '생 갈매기',
        photoUrl: 'http://t1.kakaocdn.net/mystore/FAKE0001',
      },
      { name: '된장찌개, 공기밥', photoUrl: '' },
    ]);
    expect(parsePanelMenus(JSON.parse(fixture('panel-no-menu.json')))).toEqual(
      [],
    );
  });
});
