import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BlockedError,
  CrawlOptions,
  CrawlStore,
  HttpFetcher,
  HttpResponse,
  menuPageUrl,
  NaverPlaceCrawler,
  restaurantListUrl,
  toCsvRows,
} from './naver-place-crawler';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

const OPTIONS: CrawlOptions = {
  areas: ['서울 송파구 잠실본동'],
  keywords: ['음식점'],
  center: { x: 127.1, y: 37.5 },
  district: '송파구',
  maxPages: 2,
  pageSize: 50,
  minDelayMs: 1000,
  maxDelayMs: 3000,
  maxRetries: 2,
  backoffBaseMs: 10000,
  maxConsecutiveBlocks: 2,
  concurrency: 1,
  maxPlaces: 0,
  discoverOnly: false,
};

const LIST_PAGE_1 = restaurantListUrl(
  '서울 송파구 잠실본동 음식점',
  1,
  OPTIONS,
);
const LIST_PAGE_2 = restaurantListUrl(
  '서울 송파구 잠실본동 음식점',
  2,
  OPTIONS,
);

class FakeFetcher implements HttpFetcher {
  readonly calls: string[] = [];

  constructor(
    private readonly routes: Record<string, Array<HttpResponse | Error>>,
  ) {}

  async get(url: string): Promise<HttpResponse> {
    this.calls.push(url);
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

// 목록·메뉴 페이지를 테스트 안에서 직접 만든다.
const apolloPage = (state: Record<string, unknown>): HttpResponse => ({
  status: 200,
  body: `<script>window.__APOLLO_STATE__ = ${JSON.stringify(state)};</script>`,
});
const listPage = (...places: Array<[string, string]>) =>
  apolloPage(
    Object.fromEntries(
      places.map(([id, address]) => [
        `RestaurantListSummary:${id}`,
        { __typename: 'RestaurantListSummary', id, name: `식당${id}`, address },
      ]),
    ),
  );

describe('NaverPlaceCrawler', () => {
  let dir: string;
  let store: CrawlStore;
  let sleeps: number[];

  const crawler = (fetcher: HttpFetcher, options: Partial<CrawlOptions> = {}) =>
    new NaverPlaceCrawler({ ...OPTIONS, ...options }, store, {
      fetcher,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0.5,
      log: () => undefined,
    });

  const csvLines = () =>
    readFileSync(store.csvPath, 'utf8').split('\r\n').filter(Boolean);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'naver-crawl-'));
    store = new CrawlStore(join(dir, 'menus.csv'));
    sleeps = [];
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('송파구 식당만 모아 메뉴 1개당 1행, 메뉴 없는 식당은 빈 메뉴 1행으로 쓴다', async () => {
    const fetcher = new FakeFetcher({
      [LIST_PAGE_1]: [ok('restaurant-list.html')],
      // 2쪽은 새 식당이 없어 페이지 넘김을 멈춘다
      [LIST_PAGE_2]: [ok('restaurant-list.html')],
      [menuPageUrl('1000000001')]: [ok('menu-list.html')],
      [menuPageUrl('1000000002')]: [ok('menu-empty.html')],
    });

    const summary = await crawler(fetcher).run();

    expect(summary).toEqual({
      discoveredPlaces: 2,
      crawledPlaces: 2,
      skippedPlaces: 0,
      failedPlaces: 0,
      menuRows: 3,
    });
    expect(fetcher.calls).not.toContain(menuPageUrl('1000000003'));
    expect(csvLines()).toEqual([
      '\uFEFFplace_id,식당명,주소,카테고리,메뉴명,가격,사진URL',
      '1000000001,가상 김밥 잠실점,서울 송파구 가상로 1,분식,기본김밥,"3,500",https://ldb-phinf.pstatic.net/fake/kimbap-1.jpg',
      '1000000001,가상 김밥 잠실점,서울 송파구 가상로 1,분식,참치김밥,"5,000",',
      '1000000001,가상 김밥 잠실점,서울 송파구 가상로 1,분식,"라면, 떡볶이 세트",변동,https://ldb-phinf.pstatic.net/fake/set.jpg',
      '1000000002,"가상 ""따옴표"" 식당 {중괄호}",서울 송파구 잠실동 2-2,한식,,,',
    ]);
    // 요청마다 1~3초 사이 지연(random=0.5 → 2초)
    expect(sleeps.every((ms) => ms === 2000)).toBe(true);
  });

  it('다시 실행하면 끝난 검색과 이미 CSV에 있는 식당을 건너뛴다', async () => {
    await crawler(
      new FakeFetcher({
        [LIST_PAGE_1]: [ok('restaurant-list.html')],
        [menuPageUrl('1000000001')]: [ok('menu-list.html')],
      }),
      { maxPages: 1, maxPlaces: 1 },
    ).run();

    const second = new FakeFetcher({
      [menuPageUrl('1000000002')]: [ok('menu-empty.html')],
    });
    const summary = await crawler(second, { maxPages: 1 }).run();

    expect(second.calls).toEqual([menuPageUrl('1000000002')]);
    expect(summary).toMatchObject({
      discoveredPlaces: 2,
      crawledPlaces: 1,
      skippedPlaces: 1,
    });
    expect(csvLines()).toHaveLength(1 + 3 + 1);
  });

  it('429와 네트워크 오류는 지수 백오프 후 재시도한다', async () => {
    const fetcher = new FakeFetcher({
      [LIST_PAGE_1]: [ok('restaurant-list.html')],
      [menuPageUrl('1000000001')]: [
        { status: 429, body: '' },
        new Error('socket hang up'),
        ok('menu-list.html'),
      ],
      [menuPageUrl('1000000002')]: [ok('menu-empty.html')],
    });

    const summary = await crawler(fetcher, { maxPages: 1 }).run();

    expect(summary).toMatchObject({ crawledPlaces: 2, failedPlaces: 0 });
    // 10초, 20초 백오프(+ 지터 0.5 × 절반)
    expect(sleeps).toEqual(expect.arrayContaining([12500, 25000]));
  });

  it('연속 차단이 상한에 닿으면 멈추고, 다음 실행에서 남은 식당부터 이어간다', async () => {
    const blocked = { status: 200, body: fixture('blocked.html') };
    const first = new FakeFetcher({
      [LIST_PAGE_1]: [ok('restaurant-list.html')],
      [menuPageUrl('1000000001')]: [blocked],
      [menuPageUrl('1000000002')]: [blocked],
    });

    await expect(crawler(first, { maxPages: 1 }).run()).rejects.toBeInstanceOf(
      BlockedError,
    );
    expect(csvLines()).toHaveLength(1);
    expect(readFileSync(store.failedPath, 'utf8')).toContain('1000000001');

    const second = new FakeFetcher({
      [menuPageUrl('1000000001')]: [ok('menu-list.html')],
      [menuPageUrl('1000000002')]: [ok('menu-empty.html')],
    });
    const summary = await crawler(second, { maxPages: 1 }).run();
    expect(summary).toMatchObject({ crawledPlaces: 2, failedPlaces: 0 });
  });

  it('목록 검색이 실패하면 완료로 기록하지 않아 다음 실행에서 다시 검색한다', async () => {
    await crawler(
      new FakeFetcher({ [LIST_PAGE_1]: [{ status: 404, body: '' }] }),
      {
        maxPages: 1,
      },
    ).run();
    expect(store.completedQueries().size).toBe(0);
  });

  it('CSV 값의 줄바꿈은 공백으로 바꿔 한 줄이 한 행이 되게 한다', () => {
    const [row] = toCsvRows(
      { placeId: '1', name: '줄\n바꿈', address: '', category: '' },
      [{ name: 'a', price: '1', imageUrl: '' }],
    );
    expect(row).toBe('1,줄 바꿈,,,a,1,');
  });

  it('앞 검색에서 찾은 식당만 있는 쪽이어도 다음 쪽을 계속 본다', async () => {
    const options = { keywords: ['음식점', '한식'] };
    const query = (keyword: string, page: number) =>
      restaurantListUrl(`서울 송파구 잠실본동 ${keyword}`, page, OPTIONS);
    const fetcher = new FakeFetcher({
      [query('음식점', 1)]: [listPage(['1', '서울 송파구 a'])],
      [query('음식점', 2)]: [listPage()],
      [query('한식', 1)]: [listPage(['1', '서울 송파구 a'])],
      [query('한식', 2)]: [listPage(['2', '서울 송파구 b'])],
      [query('한식', 3)]: [listPage(['2', '서울 송파구 b'])],
    });

    const summary = await crawler(fetcher, {
      ...options,
      discoverOnly: true,
    }).run();

    expect(summary.discoveredPlaces).toBe(2);
    // 3쪽은 2쪽과 같은 결과라 쪽 넘김을 멈춘다
    expect(fetcher.calls).not.toContain(query('한식', 4));
  });

  it('목록 페이지 파싱이 실패해도 멈추지 않고 그 검색만 재시도 대상으로 남긴다', async () => {
    const fetcher = new FakeFetcher({
      [LIST_PAGE_1]: [{ status: 200, body: '<html>빈 껍데기</html>' }],
    });
    await expect(
      crawler(fetcher, { maxPages: 1 }).run(),
    ).resolves.toMatchObject({
      discoveredPlaces: 0,
    });
    expect(store.completedQueries().size).toBe(0);
  });

  it('중단으로 덜 쓰인 places.jsonl 줄과 CSV 마지막 줄을 무시·정리한다', async () => {
    writeFileSync(
      store.placesPath,
      `${JSON.stringify({ placeId: '1000000002', name: 'n', address: '', category: '' })}\n{"placeId":"10`,
    );
    writeFileSync(
      store.csvPath,
      '\uFEFFplace_id,식당명,주소,카테고리,메뉴명,가격,사진URL\r\n1000000002,가상 메뉴',
    );
    const fetcher = new FakeFetcher({
      [menuPageUrl('1000000002')]: [ok('menu-empty.html')],
    });

    const summary = await crawler(fetcher, { areas: [] }).run();

    expect(summary).toMatchObject({ discoveredPlaces: 1, crawledPlaces: 1 });
    expect(csvLines()).toEqual([
      '\uFEFFplace_id,식당명,주소,카테고리,메뉴명,가격,사진URL',
      '1000000002,n,서울 송파구 잠실동 2-2,한식,,,',
    ]);
  });

  it('마지막 재시도가 실패하면 백오프 없이 바로 포기한다', async () => {
    const fetcher = new FakeFetcher({
      [LIST_PAGE_1]: [{ status: 429, body: '' }],
    });
    await crawler(fetcher, { maxPages: 1, maxConsecutiveBlocks: 5 }).run();
    expect(sleeps).toEqual([2000, 12500, 2000, 25000, 2000]);
  });

  it('목록에 주소가 없던 식당은 메뉴 페이지 주소로 다시 걸러 제외 목록에 남긴다', async () => {
    const menuPage = apolloPage({
      'PlaceDetailBase:7': {
        __typename: 'PlaceDetailBase',
        name: '강남 식당',
        roadAddress: '서울 강남구 가상로 7',
      },
      'Menu:7_0': { __typename: 'Menu', name: '메뉴', price: '1,000' },
    });
    await crawler(
      new FakeFetcher({
        [LIST_PAGE_1]: [listPage(['7', ''])],
        [menuPageUrl('7')]: [menuPage],
      }),
      { maxPages: 1 },
    ).run();
    expect(csvLines()).toHaveLength(1);

    const second = new FakeFetcher({});
    await crawler(second, { maxPages: 1 }).run();
    expect(second.calls).toEqual([]);
  });
});
