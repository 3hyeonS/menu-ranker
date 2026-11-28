// 행정동 경계(GeoJSON)로 수집 지역 목록(폴더·검색 사각형들·주소 필터)을 만든다. 이슈 #47(수도권)·#49(광역시·세종).
// 지역 하나를 bbox 하나로 검색하면 모양이 불규칙한 시·군에서 이웃 지역(특히 서울)을 다시 훑는다.
// 그래서 경계를 작은 격자로 래스터화하고, 지역에 걸친 칸만 사각형 몇 개로 합쳐 검색한다.
// 파일 접근 없음. CLI는 build-region-list.ts, 실행 방법은 docs/kakao-map-menu-crawler.md.
import { Rect } from './kakao-place-crawler';

/** [경도, 위도] */
type Position = number[];
/** 바깥 고리 + 구멍 고리들 */
type Polygon = Position[][];

export interface GeoFeature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

export interface RegionSpec {
  /** 출력 폴더(`kakao-map/` 아래 상대 경로). 예: `경기/수원시`, `광주/서구`, `세종/세종시` */
  folder: string;
  /** 카카오 주소 앞부분(크롤러는 주소에 이 문자열이 들어 있는지 본다). 예: `경기 수원시`, `전남광주통합특별시 서구`. */
  filter: string;
}

export interface RegionCover extends RegionSpec {
  rects: Rect[];
}

export interface CoverOptions {
  /** 래스터 칸 크기(도). */
  cellDeg: number;
  /** 지역 칸을 사방으로 넓힐 칸 수. 칸 중심 판정 오차와 경계 근처 좌표 오차를 덮는다. */
  dilateCells: number;
  /** 검색 사각형을 맞출 굵은 칸 크기(래스터 칸 개수). 클수록 사각형 수는 줄고 겹침은 는다. */
  coarseCells: number;
}

/** 0.005도(약 500m) 칸, 1칸 여유, 0.01도 굵은 칸. 2026-10 경계 기준 루트 사각형 수도권 863개·광역시·세종 475개. */
export const DEFAULT_COVER_OPTIONS: CoverOptions = {
  cellDeg: 0.005,
  dilateCells: 1,
  coarseCells: 2,
};

/** 시·도 하나를 수집 지역으로 나누는 규칙. */
export interface SidoRule {
  /** 행정동 데이터의 `sido` 코드. */
  code: string;
  /** 폴더 첫 단계(`kakao-map/<folder>/…`). 카카오 표기와 달라도 된다(광주). */
  folder: string;
  /** 카카오 주소의 시·도 표기. 예: `부산`, `전남광주통합특별시`, `세종특별자치시`. */
  address: string;
  /**
   * 시·도 전체를 지역 하나로 묶을 때 폴더 둘째 단계 이름(세종: 시 아래 군·구가 없다).
   * 이때 주소 필터는 `address` 하나다. 없으면 시·군·구마다 지역 하나다.
   */
  wholeName?: string;
  /** 이 시·군·구만 수집한다(행정동 `sggnm` 이름). 없으면 전부. */
  sggNames?: readonly string[];
  /** 일반구(`수원시장안구`)를 시(`수원시`)로 묶는다. 경기만 쓴다. */
  foldCityDistricts?: boolean;
}

/** 수도권(#47): 인천 군·구, 경기 시·군. */
export const CAPITAL_AREA: readonly SidoRule[] = [
  { code: '28', folder: '인천', address: '인천' },
  { code: '41', folder: '경기', address: '경기', foldCityDistricts: true },
];

/**
 * 광역시·세종(#49). 카카오 주소 표기는 2026-11-28 공식 로컬 API 표본으로 확인했다.
 * 광주는 2026-07 전남과 합쳐 `전남광주통합특별시`(sido 12)가 됐고, 범위는 옛 광주광역시 5개 구다.
 */
export const METRO_AREA: readonly SidoRule[] = [
  { code: '26', folder: '부산', address: '부산' },
  { code: '27', folder: '대구', address: '대구' },
  {
    code: '12',
    folder: '광주',
    address: '전남광주통합특별시',
    sggNames: ['동구', '서구', '남구', '북구', '광산구'],
  },
  { code: '30', folder: '대전', address: '대전' },
  { code: '31', folder: '울산', address: '울산' },
  {
    code: '36',
    folder: '세종',
    address: '세종특별자치시',
    wholeName: '세종시',
  },
];

/** `build-region-list.ts --area=<이름>`으로 고르는 시·도 묶음. 순서가 TSV 순서다. */
export const REGION_AREAS: ReadonlyMap<string, readonly SidoRule[]> = new Map([
  ['capital', CAPITAL_AREA],
  ['metro', METRO_AREA],
]);

/**
 * 행정동 속성 → 수집 지역. 군·구(경기는 시·군) 단위이고, 세종처럼 `wholeName`이 있으면 시·도 하나다.
 * `foldCityDistricts`면 일반구(`수원시장안구`)를 시(`수원시`)로 묶는다. 주소 필터가 `경기 수원시`라 구 이름이 바뀌어도 안전하다.
 */
export function regionOf(
  rules: readonly SidoRule[],
  properties: Record<string, unknown>,
): RegionSpec | null {
  const rule = rules.find((r) => r.code === String(properties.sido ?? ''));
  const sggName = String(properties.sggnm ?? '').trim();
  if (!rule || !sggName) return null;
  if (rule.sggNames && !rule.sggNames.includes(sggName)) return null;
  if (rule.wholeName)
    return { folder: `${rule.folder}/${rule.wholeName}`, filter: rule.address };
  let name = sggName;
  const cityEnd = sggName.indexOf('시');
  if (rule.foldCityDistricts && cityEnd > 0 && cityEnd < sggName.length - 1)
    name = sggName.slice(0, cityEnd + 1);
  return {
    folder: `${rule.folder}/${name}`,
    filter: `${rule.address} ${name}`,
  };
}

/**
 * 규칙에 있는데 결과에 없는 시·도·시·군·구. 행정동 파일 판이 달라 코드·이름이 바뀌면
 * (예: 통합 전 `광주광역시` sido 29) 그 지역이 조용히 빠지므로 CLI가 멈추는 데 쓴다.
 */
export function missingRegions(
  rules: readonly SidoRule[],
  regions: readonly RegionSpec[],
): string[] {
  const folders = new Set(regions.map((r) => r.folder));
  return rules.flatMap((rule) => {
    if (rule.sggNames)
      return rule.sggNames
        .filter((name) => !folders.has(`${rule.folder}/${name}`))
        .map((name) => `${rule.folder}/${name}(sido ${rule.code})`);
    const found = [...folders].some((f) => f.startsWith(`${rule.folder}/`));
    return found ? [] : [`${rule.folder}(sido ${rule.code})`];
  });
}

function polygonsOf(geometry: GeoFeature['geometry']): Polygon[] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates as Polygon];
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates as Polygon[];
  return [];
}

function insideRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

const cellKey = (i: number, j: number) => `${i},${j}`;

/**
 * 폴리곤을 칸 집합(`i,j`, 칸 [i*d, (i+1)*d))에 더한다. 칸 중심이 안에 있는 칸과,
 * 바깥 경계선이 지나는 칸(중심 판정에 걸리지 않는 작은 섬·칸보다 좁은 강변 땅)을 넣는다.
 */
export function rasterizePolygon(
  polygon: Polygon,
  cellDeg: number,
  cells: Set<string>,
): void {
  const [outer, ...holes] = polygon;
  if (!outer?.length) return;
  // 꼭짓점이 아주 많은 고리에서 Math.min(...xs)는 인자 수 한도를 넘을 수 있어 반복문으로 구한다.
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of outer) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const [i1, i2] = [minX, maxX].map((v) => Math.floor(v / cellDeg));
  const [j1, j2] = [minY, maxY].map((v) => Math.floor(v / cellDeg));
  for (let i = i1; i <= i2; i += 1) {
    for (let j = j1; j <= j2; j += 1) {
      const cx = (i + 0.5) * cellDeg;
      const cy = (j + 0.5) * cellDeg;
      if (
        insideRing(cx, cy, outer) &&
        !holes.some((hole) => insideRing(cx, cy, hole))
      )
        cells.add(cellKey(i, j));
    }
  }
  // 경계선을 칸 크기의 절반 간격으로 따라가며 지나는 칸을 넣는다(꼭짓점 칸 포함).
  // 칸 모서리를 살짝 스치는 경우는 놓칠 수 있지만 coverRects의 여유 칸이 덮는다.
  const step = cellDeg / 2;
  for (let k = 0; k < outer.length; k += 1) {
    const [x1, y1] = outer[k];
    const [x2, y2] = outer[(k + 1) % outer.length];
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let t = 0; t <= n; t += 1) {
      const x = x1 + ((x2 - x1) * t) / n;
      const y = y1 + ((y2 - y1) * t) / n;
      cells.add(cellKey(Math.floor(x / cellDeg), Math.floor(y / cellDeg)));
    }
  }
}

/** 소수 오차 없이 칸 경계를 도 단위로 쓴다(0.005 단위 → 소수 3자리). */
const degrees = (index: number, cellDeg: number) =>
  Number((index * cellDeg).toFixed(6));

/**
 * 칸 집합을 넓힌 뒤 굵은 칸으로 올리고, 행마다 이어진 구간을 만든 다음 위아래로 같은 구간을 합쳐 사각형으로 만든다.
 * 결과는 아래(위도)→왼쪽(경도) 순서다.
 */
export function coverRects(cells: Set<string>, options: CoverOptions): Rect[] {
  const { cellDeg, dilateCells: d, coarseCells: g } = options;
  const coarse = new Set<string>();
  for (const key of cells) {
    const [i, j] = key.split(',').map(Number);
    for (let a = -d; a <= d; a += 1)
      for (let b = -d; b <= d; b += 1)
        coarse.add(cellKey(Math.floor((i + a) / g), Math.floor((j + b) / g)));
  }
  const rows = new Map<number, number[]>();
  for (const key of coarse) {
    const [i, j] = key.split(',').map(Number);
    rows.set(j, [...(rows.get(j) ?? []), i]);
  }
  // [x시작, x끝, y] 구간
  const runs: Array<[number, number, number]> = [];
  for (const [j, xs] of rows) {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];
    for (const x of xs.slice(1)) {
      if (x === prev + 1) {
        prev = x;
        continue;
      }
      runs.push([start, prev, j]);
      start = prev = x;
    }
    runs.push([start, prev, j]);
  }
  runs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  // [x시작, x끝, y시작, y끝]
  const merged: Array<[number, number, number, number]> = [];
  for (const [x1, x2, y] of runs) {
    const last = merged[merged.length - 1];
    if (last && last[0] === x1 && last[1] === x2 && last[3] === y - 1)
      last[3] = y;
    else merged.push([x1, x2, y, y]);
  }
  const step = cellDeg * g;
  return merged
    .sort((a, b) => a[2] - b[2] || a[0] - b[0])
    .map(([x1, x2, y1, y2]) => [
      degrees(x1, step),
      degrees(y1, step),
      degrees(x2 + 1, step),
      degrees(y2 + 1, step),
    ]);
}

/** 행정동 피처들을 지역별로 묶어 검색 사각형을 만든다. 규칙(시·도) 순서 → 지역 이름순. */
export function buildRegionCovers(
  features: readonly GeoFeature[],
  rules: readonly SidoRule[],
  options: CoverOptions = DEFAULT_COVER_OPTIONS,
): RegionCover[] {
  const regions = new Map<string, { spec: RegionSpec; cells: Set<string> }>();
  for (const feature of features) {
    const spec = regionOf(rules, feature.properties ?? {});
    if (!spec) continue;
    const region = regions.get(spec.folder) ?? { spec, cells: new Set() };
    regions.set(spec.folder, region);
    for (const polygon of polygonsOf(feature.geometry))
      rasterizePolygon(polygon, options.cellDeg, region.cells);
  }
  const sidoOrder = (folder: string) =>
    rules.findIndex((rule) => folder.startsWith(`${rule.folder}/`));
  return [...regions.values()]
    .sort(
      (a, b) =>
        sidoOrder(a.spec.folder) - sidoOrder(b.spec.folder) ||
        a.spec.folder.localeCompare(b.spec.folder, 'ko'),
    )
    .map(({ spec, cells }) => ({ ...spec, rects: coverRects(cells, options) }));
}

/** 지역 목록 한 줄: `폴더<TAB>사각형;사각형…<TAB>주소 필터` (서울 districts-north.tsv와 같은 칸 구성). */
export function formatRegionLine(region: RegionCover): string {
  return [
    region.folder,
    region.rects.map((rect) => rect.join(',')).join(';'),
    region.filter,
  ].join('\t');
}
