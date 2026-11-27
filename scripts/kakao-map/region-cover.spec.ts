import {
  buildRegionCovers,
  capitalRegionOf,
  CoverOptions,
  coverRects,
  formatRegionLine,
  GeoFeature,
  rasterizePolygon,
} from './region-cover';

// 테스트는 계산이 쉬운 1도 칸을 쓴다.
const UNIT: CoverOptions = { cellDeg: 1, dilateCells: 0, coarseCells: 1 };

const square = (x1: number, y1: number, x2: number, y2: number) => [
  [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
    [x1, y1],
  ],
];

const feature = (
  sido: string,
  sggnm: string,
  polygon: number[][][],
): GeoFeature => ({
  properties: { sido, sggnm },
  geometry: { type: 'MultiPolygon', coordinates: [polygon] },
});

describe('capitalRegionOf', () => {
  it('경기는 시·군 단위(일반구는 시로 묶음), 인천은 군·구 단위로 폴더·주소 필터를 만든다', () => {
    expect(capitalRegionOf({ sido: '41', sggnm: '수원시장안구' })).toEqual({
      folder: '경기/수원시',
      filter: '경기 수원시',
    });
    expect(capitalRegionOf({ sido: '41', sggnm: '광주시' })).toEqual({
      folder: '경기/광주시',
      filter: '경기 광주시',
    });
    expect(capitalRegionOf({ sido: '41', sggnm: '가평군' })).toEqual({
      folder: '경기/가평군',
      filter: '경기 가평군',
    });
    // 2026-07 개편 후 이름. 카카오 주소도 새 이름을 쓴다(2026-11-27 시험 수집).
    expect(capitalRegionOf({ sido: '28', sggnm: '제물포구' })).toEqual({
      folder: '인천/제물포구',
      filter: '인천 제물포구',
    });
  });

  it('서울 등 다른 시·도와 이름 없는 행정동은 뺀다', () => {
    expect(capitalRegionOf({ sido: '11', sggnm: '중구' })).toBeNull();
    expect(capitalRegionOf({ sido: '28', sggnm: '' })).toBeNull();
  });
});

describe('rasterizePolygon', () => {
  it('칸 중심이 안에 있는 칸과 꼭짓점이 든 칸을 넣고, 구멍 안 칸은 뺀다', () => {
    const cells = new Set<string>();
    rasterizePolygon([...square(0, 0, 3, 3), ...square(1, 1, 2, 2)], 1, cells);
    // 중심 (1.5,1.5) 칸은 구멍이라 빠지고, 꼭짓점 (3,3)이 든 칸(3,3)은 들어간다.
    expect(cells.has('1,1')).toBe(false);
    expect(cells.has('0,0')).toBe(true);
    expect(cells.has('2,2')).toBe(true);
    expect(cells.has('3,3')).toBe(true);
  });

  it('칸보다 작은 섬도 꼭짓점 칸으로 남긴다', () => {
    const cells = new Set<string>();
    rasterizePolygon(square(5.2, 7.2, 5.3, 7.3), 1, cells);
    expect([...cells]).toEqual(['5,7']);
  });
});

describe('coverRects', () => {
  it('이어진 칸을 사각형 하나로, ㄱ자 모양은 사각형 두 개로 합친다', () => {
    expect(coverRects(new Set(['0,0', '1,0', '0,1', '1,1']), UNIT)).toEqual([
      [0, 0, 2, 2],
    ]);
    // 아래 줄 3칸 + 왼쪽 위 1칸
    expect(coverRects(new Set(['0,0', '1,0', '2,0', '0,1']), UNIT)).toEqual([
      [0, 0, 3, 1],
      [0, 1, 1, 2],
    ]);
  });

  it('여유 칸만큼 넓히고 굵은 칸 단위로 맞춘다', () => {
    expect(
      coverRects(new Set(['2,2']), {
        cellDeg: 0.005,
        dilateCells: 1,
        coarseCells: 2,
      }),
    ).toEqual([[0, 0, 0.02, 0.02]]);
    expect(
      coverRects(new Set(['5,5']), {
        cellDeg: 0.005,
        dilateCells: 0,
        coarseCells: 2,
      }),
    ).toEqual([[0.02, 0.02, 0.03, 0.03]]);
  });
});

describe('buildRegionCovers', () => {
  it('같은 시의 일반구를 한 지역으로 묶고, 인천 → 경기 순으로 정렬해 TSV 줄로 쓴다', () => {
    const regions = buildRegionCovers(
      [
        feature('41', '수원시팔달구', square(1, 0, 2, 1)),
        feature('41', '수원시장안구', square(0, 0, 1, 1)),
        feature('28', '연수구', square(5, 5, 6, 6)),
        feature('11', '종로구', square(9, 9, 10, 10)),
      ],
      capitalRegionOf,
      UNIT,
    );
    expect(regions.map((r) => r.folder)).toEqual([
      '인천/연수구',
      '경기/수원시',
    ]);
    // 꼭짓점 칸(오른쪽·위 경계)까지 들어가 사각형이 한 칸씩 넓다.
    expect(formatRegionLine(regions[1])).toBe(
      '경기/수원시\t0,0,3,2\t경기 수원시',
    );
  });
});
