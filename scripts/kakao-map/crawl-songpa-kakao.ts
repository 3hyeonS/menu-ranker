// 카카오 기준 서울 송파구 식당 목록(공식 로컬 API)과 메뉴명·사진 URL(카카오맵 비공식 panel3)을 수집해
// 식당 CSV·메뉴 CSV로 저장한다. 이슈 #28. 실행 방법은 docs/kakao-map-menu-crawler.md.
import 'dotenv/config';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import {
  arg,
  assertUntrackedOutput,
  intArg,
  listArg,
} from '../crawl-common/crawl-cli';
import { HttpFetcher } from '../crawl-common/polite-requester';
import { DEFAULT_EXCLUDED_CATEGORIES } from '../naver-map/crawl-songpa-menus';
import {
  KakaoCrawlOptions,
  KakaoCrawlStore,
  KakaoPlaceCrawler,
  Rect,
} from './kakao-place-crawler';

// 송파구를 덮는 사각형(경도·위도). 주변 구 식당은 주소 필터로 버린다.
export const SONGPA_RECT: Rect = [127.05, 37.455, 127.2, 37.555];

class FetchHttpFetcher implements HttpFetcher {
  constructor(private readonly timeoutMs: number) {}

  async get(url: string, headers: Record<string, string> = {}) {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'application/json',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        ...headers,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return { status: response.status, body: await response.text() };
  }
}

function rectArg(): Rect {
  const raw = arg('rect');
  if (raw === undefined) return SONGPA_RECT;
  const values = raw.split(',').map(Number);
  if (
    values.length !== 4 ||
    values.some((value) => !Number.isFinite(value)) ||
    values[0] >= values[2] ||
    values[1] >= values[3]
  )
    throw new Error(`--rect는 x1,y1,x2,y2(x1<x2, y1<y2)여야 합니다: ${raw}`);
  return values as Rect;
}

export function parseOptions(): {
  outDir: string;
  options: KakaoCrawlOptions;
  timeoutMs: number;
} {
  const outDir = arg('out-dir');
  if (!outDir) throw new Error('--out-dir=<출력 폴더>가 필요합니다');
  const restApiKey = process.env.KAKAO_CLIENT_ID;
  if (!restApiKey)
    throw new Error(
      'KAKAO_CLIENT_ID(카카오 REST API 키) 환경변수가 필요합니다',
    );
  const maxRetries = intArg('max-retries', 3, 0);
  const backoffBaseMs = intArg('backoff-ms', 10000, 0);
  const maxConsecutiveBlocks = intArg('max-consecutive-blocks', 3, 1);
  const options: KakaoCrawlOptions = {
    restApiKey,
    rect: rectArg(),
    district: arg('district') ?? '송파구',
    maxDepth: intArg('max-depth', 12, 0, 20),
    excludedCategories: listArg(
      'exclude-categories',
      DEFAULT_EXCLUDED_CATEGORIES,
    ),
    search: {
      minDelayMs: intArg('search-min-delay-ms', 100, 0),
      maxDelayMs: intArg('search-max-delay-ms', 300, 0),
      maxRetries,
      backoffBaseMs,
      maxConsecutiveBlocks,
    },
    panel: {
      minDelayMs: intArg('min-delay-ms', 1000, 0),
      maxDelayMs: intArg('max-delay-ms', 3000, 0),
      maxRetries,
      backoffBaseMs,
      maxConsecutiveBlocks,
    },
    appVersion: arg('app-version') ?? '6.6.0',
    concurrency: intArg('concurrency', 1, 1, 2),
    maxPlaces: intArg('max-places', 0, 0),
    discoverOnly: process.argv.includes('--discover-only'),
  };
  for (const [name, policy] of [
    ['search-', options.search],
    ['', options.panel],
  ] as const) {
    if (policy.maxDelayMs < policy.minDelayMs)
      throw new Error(
        `--${name}max-delay-ms는 --${name}min-delay-ms 이상이어야 합니다`,
      );
  }
  return {
    outDir: resolve(outDir),
    options,
    timeoutMs: intArg('timeout-ms', 15000, 1),
  };
}

async function main(): Promise<void> {
  const { outDir, options, timeoutMs } = parseOptions();
  mkdirSync(outDir, { recursive: true });
  const store = new KakaoCrawlStore(outDir);
  // 진행 상태 파일도 식당 데이터이므로 모두 확인한다.
  store.paths.forEach((path) => assertUntrackedOutput(path, '/kakao-map/'));
  const crawler = new KakaoPlaceCrawler(options, store, {
    fetcher: new FetchHttpFetcher(timeoutMs),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    random: Math.random,
    log: (message) => console.log(message),
  });
  console.log(`출력: ${outDir}\n검색 영역: ${options.rect.join(',')}`);
  const summary = await crawler.run();
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    `식당: ${store.restaurantsPath}\n메뉴: ${store.menusPath}\n실패 목록: ${store.failedPath} (다시 실행하면 완료되지 않은 식당만 재시도)`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
