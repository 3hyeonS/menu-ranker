// 네이버 지도(플레이스)에서 서울 송파구 식당의 메뉴명·가격·사진 URL을 수집해 CSV로 저장한다.
// 내부 분석 전용(이슈 #26). 실행 방법은 docs/naver-map-menu-crawler.md.
import { dirname, resolve } from 'path';
import { mkdirSync } from 'fs';
import {
  arg,
  assertUntrackedOutput,
  intArg,
  listArg,
} from '../crawl-common/crawl-cli';
import {
  CrawlOptions,
  CrawlStore,
  HttpFetcher,
  NaverPlaceCrawler,
} from './naver-place-crawler';

// 송파구 행정동 27개.
export const SONGPA_DONGS = [
  '풍납1동',
  '풍납2동',
  '거여1동',
  '거여2동',
  '마천1동',
  '마천2동',
  '방이1동',
  '방이2동',
  '오륜동',
  '오금동',
  '송파1동',
  '송파2동',
  '석촌동',
  '삼전동',
  '가락본동',
  '가락1동',
  '가락2동',
  '문정1동',
  '문정2동',
  '장지동',
  '위례동',
  '잠실본동',
  '잠실2동',
  '잠실3동',
  '잠실4동',
  '잠실6동',
  '잠실7동',
];

// 검색 결과 상한을 피하려고 업종 키워드로 잘게 나눈다.
export const DEFAULT_KEYWORDS = [
  '음식점',
  '한식',
  '중식',
  '일식',
  '양식',
  '아시아음식',
  '분식',
  '치킨',
  '피자',
  '패스트푸드',
  '고기',
  '해산물',
];

// 카페·디저트·술집은 "식당"에 넣지 않는다(이슈 #26 결정, 2026-10-28).
// `음식점` 검색에도 섞여 나오므로 네이버 카테고리 문자열에 들어 있는지로 거른다.
// `바`·`차`처럼 짧은 단어는 `바베큐`·`차돌` 같은 음식점까지 걸리므로 쓰지 않는다.
export const DEFAULT_EXCLUDED_CATEGORIES = [
  '카페',
  '디저트',
  '베이커리',
  '제과',
  '케이크',
  '아이스크림',
  '도넛',
  '와플',
  '커피',
  '주점',
  '술집',
  '호프',
  '이자카야',
  '바(BAR)',
  '포장마차',
  '와인',
  '칵테일',
  '전통주',
];

// 송파구청 부근. 검색어에 동 이름이 있어 대략적인 기준점이면 된다.
const SONGPA_CENTER = { x: 127.1059, y: 37.5145 };

class FetchHttpFetcher implements HttpFetcher {
  constructor(private readonly timeoutMs: number) {}

  async get(url: string) {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        Referer: 'https://map.naver.com/',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return { status: response.status, body: await response.text() };
  }
}

export function parseOptions(): {
  out: string;
  options: CrawlOptions;
  timeoutMs: number;
} {
  const outArg = arg('out');
  if (!outArg) throw new Error('--out=<CSV 경로>가 필요합니다');
  const dongs = listArg('dongs', SONGPA_DONGS);
  const options: CrawlOptions = {
    areas: dongs.map((dong) => `서울 송파구 ${dong}`),
    keywords: listArg('keywords', DEFAULT_KEYWORDS),
    center: SONGPA_CENTER,
    district: arg('district') ?? '송파구',
    maxPages: intArg('max-pages', 5, 1),
    pageSize: intArg('page-size', 50, 1),
    minDelayMs: intArg('min-delay-ms', 1000, 0),
    maxDelayMs: intArg('max-delay-ms', 3000, 0),
    maxRetries: intArg('max-retries', 3, 0),
    backoffBaseMs: intArg('backoff-ms', 10000, 0),
    maxConsecutiveBlocks: intArg('max-consecutive-blocks', 3, 1),
    concurrency: intArg('concurrency', 1, 1, 2),
    maxPlaces: intArg('max-places', 0, 0),
    discoverOnly: process.argv.includes('--discover-only'),
    excludedCategories: listArg(
      'exclude-categories',
      DEFAULT_EXCLUDED_CATEGORIES,
    ),
  };
  if (options.maxDelayMs < options.minDelayMs)
    throw new Error('--max-delay-ms는 --min-delay-ms 이상이어야 합니다');
  return {
    out: resolve(outArg),
    options,
    timeoutMs: intArg('timeout-ms', 15000, 1),
  };
}

async function main(): Promise<void> {
  const { out, options, timeoutMs } = parseOptions();
  mkdirSync(dirname(out), { recursive: true });
  const store = new CrawlStore(out);
  // CSV 옆 진행 상태 파일도 식당 데이터이므로 모두 확인한다.
  store.paths.forEach((path) => assertUntrackedOutput(path, '/naver-map/'));
  const crawler = new NaverPlaceCrawler(options, store, {
    fetcher: new FetchHttpFetcher(timeoutMs),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    random: Math.random,
    log: (message) => console.log(message),
  });
  console.log(
    `출력: ${out}\n검색: 지역 ${options.areas.length}개 × 키워드 ${options.keywords.length}개, 최대 ${options.maxPages}쪽`,
  );
  const summary = await crawler.run();
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    `실패 목록: ${store.failedPath} (다시 실행하면 CSV에 없는 식당만 재시도)`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
