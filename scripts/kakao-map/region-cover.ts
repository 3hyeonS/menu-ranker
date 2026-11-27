// 행정동 경계(GeoJSON)로 수집 지역 목록(폴더·검색 사각형들·주소 필터)을 만든다. 이슈 #47.
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
  /** 출력 폴더(`kakao-map/` 아래 상대 경로). 예: `경기/수원시`, `인천/제물포구` */
  folder: string;
  /** 카카오 주소 앞부분. 예: `경기 수원시`. 카카오는 시·도를 `경기`·`인천`으로 줄여 쓴다. */
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

/** 0.005도(약 500m) 칸, 1칸 여유, 0.01도 굵은 칸. 2026-10 경계 기준 수도권 루트 사각형 약 870개. */
export const DEFAULT_COVER_OPTIONS: CoverOptions = {
  cellDeg: 0.005,
  dilateCells: 1,
  coarseCells: 2,
};

/** 카카오 주소의 시·도 약칭. 행정동 데이터의 `sido` 코드 기준. */
const SIDO_SHORT_NAMES: Record<string, string> = {
  '28': '인천',
  '41': '경기',
};

export const CAPITAL_AREA_SIDO_CODES = Object.keys(SIDO_SHORT_NAMES);

/**
 * 행정동 속성 → 수집 지역. 인천은 군·구, 경기는 시·군 단위다.
 * 경기의 일반구(`수원시장안구`)는 시(`수원시`)로 묶는다. 주소 필터가 `경기 수원시`라 구 이름이 바뀌어도 안전하다.
 */
export function capitalRegionOf(
  properties: Record<string, unknown>,
): RegionSpec | null {
  const sido = SIDO_SHORT_NAMES[String(properties.sido ?? '')];
  const sggName = String(properties.sggnm ?? '').trim();
  if (!sido || !sggName) return null;
  let name = sggName;
  if (sido === '경기') {
    const cityEnd = sggName.indexOf('시');
    if (cityEnd > 0 && cityEnd < sggName.length - 1)
      name = sggName.slice(0, cityEnd + 1);
  }
  return { folder: `${sido}/${name}`, filter: `${sido} ${name}` };
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
 * 꼭짓점이 든 칸(중심 판정에 걸리지 않는 작은 섬·좁은 땅)을 넣는다.
 */
export function rasterizePolygon(
  polygon: Polygon,
  cellDeg: number,
  cells: Set<string>,
): void {
  const [outer, ...holes] = polygon;
  if (!outer?.length) return;
  const xs = outer.map(([x]) => x);
  const ys = outer.map(([, y]) => y);
  const [i1, i2] = [Math.min(...xs), Math.max(...xs)].map((v) =>
    Math.floor(v / cellDeg),
  );
  const [j1, j2] = [Math.min(...ys), Math.max(...ys)].map((v) =>
    Math.floor(v / cellDeg),
  );
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
  for (const [x, y] of outer)
    cells.add(cellKey(Math.floor(x / cellDeg), Math.floor(y / cellDeg)));
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

/** 행정동 피처들을 지역별로 묶어 검색 사각형을 만든다. 인천 → 경기, 각 이름순. */
export function buildRegionCovers(
  features: readonly GeoFeature[],
  regionOf: (
    properties: Record<string, unknown>,
  ) => RegionSpec | null = capitalRegionOf,
  options: CoverOptions = DEFAULT_COVER_OPTIONS,
): RegionCover[] {
  const regions = new Map<string, { spec: RegionSpec; cells: Set<string> }>();
  for (const feature of features) {
    const spec = regionOf(feature.properties ?? {});
    if (!spec) continue;
    const region = regions.get(spec.folder) ?? { spec, cells: new Set() };
    regions.set(spec.folder, region);
    for (const polygon of polygonsOf(feature.geometry))
      rasterizePolygon(polygon, options.cellDeg, region.cells);
  }
  const sidoOrder = (folder: string) => (folder.startsWith('인천/') ? 0 : 1);
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
