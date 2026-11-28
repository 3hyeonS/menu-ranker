import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildRegionCovers,
  CAPITAL_AREA,
  CoverOptions,
  coverRects,
  formatRegionLine,
  GeoFeature,
  METRO_AREA,
  missingRegions,
  rasterizePolygon,
  regionOf,
  REGION_AREAS,
  SidoRule,
} from './region-cover';

const capitalRegionOf = (properties: Record<string, unknown>) =>
  regionOf(CAPITAL_AREA, properties);
const metroRegionOf = (properties: Record<string, unknown>) =>
  regionOf(METRO_AREA, properties);

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

describe('regionOf: 수도권(#47)', () => {
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

describe('regionOf: 광역시·세종(#49)', () => {
  it('광역시는 군·구 단위이고, 카카오 표기 약칭(`부산`·`대구`…)을 주소 필터에 쓴다', () => {
    expect(metroRegionOf({ sido: '26', sggnm: '해운대구' })).toEqual({
      folder: '부산/해운대구',
      filter: '부산 해운대구',
    });
    // 군위군은 2023-07 경북에서 대구로 편입. 카카오 주소도 `대구 군위군`(2026-11-28 표본).
    expect(metroRegionOf({ sido: '27', sggnm: '군위군' })).toEqual({
      folder: '대구/군위군',
      filter: '대구 군위군',
    });
    expect(metroRegionOf({ sido: '31', sggnm: '울주군' })).toEqual({
      folder: '울산/울주군',
      filter: '울산 울주군',
    });
  });

  it('광주는 폴더를 `광주/<구>`로 짧게 두고, 필터는 카카오 표기 `전남광주통합특별시 <구>`다. 옛 전남 시·군은 뺀다', () => {
    expect(metroRegionOf({ sido: '12', sggnm: '광산구' })).toEqual({
      folder: '광주/광산구',
      filter: '전남광주통합특별시 광산구',
    });
    expect(metroRegionOf({ sido: '12', sggnm: '나주시' })).toBeNull();
    expect(metroRegionOf({ sido: '12', sggnm: '담양군' })).toBeNull();
  });

  it('세종은 시 아래 군·구가 없어 지역 하나(`세종/세종시`, 필터 `세종특별자치시`)다', () => {
    expect(metroRegionOf({ sido: '36', sggnm: '세종시' })).toEqual({
      folder: '세종/세종시',
      filter: '세종특별자치시',
    });
  });

  it('수도권 규칙과 섞이지 않는다', () => {
    expect(metroRegionOf({ sido: '41', sggnm: '광주시' })).toBeNull();
    expect(capitalRegionOf({ sido: '26', sggnm: '중구' })).toBeNull();
    expect([...REGION_AREAS.keys()]).toEqual(['capital', 'metro']);
  });
});

describe('missingRegions', () => {
  const rules: SidoRule[] = [
    { code: '26', folder: '부산', address: '부산' },
    {
      code: '12',
      folder: '광주',
      address: '전남광주통합특별시',
      sggNames: ['동구', '광산구'],
    },
  ];

  it('규칙의 시·도나 지정한 구가 결과에 없으면 알려 준다(경계 파일 판이 달라 코드·이름이 바뀐 경우)', () => {
    expect(
      missingRegions(rules, [{ folder: '광주/동구', filter: '' }]),
    ).toEqual(['부산(sido 26)', '광주/광산구(sido 12)']);
    expect(
      missingRegions(rules, [
        { folder: '부산/중구', filter: '' },
        { folder: '광주/동구', filter: '' },
        { folder: '광주/광산구', filter: '' },
      ]),
    ).toEqual([]);
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
  it('칸 중심이 하나도 안 걸리는 좁고 긴 땅도 경계선이 지나는 칸을 모두 넣는다', () => {
    const cells = new Set<string>();
    // 폭 0.1칸, 길이 5칸. 꼭짓점은 양 끝에만 있다.
    rasterizePolygon(square(0.2, 3.1, 5.2, 3.2), 1, cells);
    expect([...cells].sort()).toEqual([
      '0,3',
      '1,3',
      '2,3',
      '3,3',
      '4,3',
      '5,3',
    ]);
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
      CAPITAL_AREA,
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

  it('광역시·세종은 규칙 순서(부산 → 대구 → 광주 → 대전 → 울산 → 세종)로 정렬한다', () => {
    const regions = buildRegionCovers(
      [
        feature('36', '세종시', square(0, 0, 1, 1)),
        feature('12', '서구', square(1, 0, 2, 1)),
        feature('12', '목포시', square(2, 0, 3, 1)),
        feature('27', '중구', square(3, 0, 4, 1)),
        feature('26', '중구', square(4, 0, 5, 1)),
      ],
      METRO_AREA,
      UNIT,
    );
    expect(regions.map((r) => [r.folder, r.filter])).toEqual([
      ['부산/중구', '부산 중구'],
      ['대구/중구', '대구 중구'],
      ['광주/서구', '전남광주통합특별시 서구'],
      ['세종/세종시', '세종특별자치시'],
    ]);
  });
});

// 커밋한 지역 목록(생성물)이 규칙과 맞는지. 생성 자체는 행정동 파일이 필요해 문서의 명령으로 확인한다.
describe('regions/*.tsv', () => {
  const read = (name: string) =>
    readFileSync(join(__dirname, 'regions', name), 'utf8')
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('\t'));

  it.each([
    ['capital-area.tsv', CAPITAL_AREA, 42],
    ['metro-area.tsv', METRO_AREA, 41],
  ] as const)(
    '%s: 3칸, 폴더·필터가 규칙의 시·도와 맞고, 필터끼리 서로 포함하지 않는다',
    (name, rules, count) => {
      const rows = read(name);
      expect(rows).toHaveLength(count);
      for (const [folder, rects, filter, ...rest] of rows) {
        expect(rest).toEqual([]);
        expect(rects).toMatch(/^[\d.,;]+$/);
        const rule = rules.find((r) => folder.startsWith(`${r.folder}/`));
        expect(rule).toBeDefined();
        expect(filter.startsWith(rule!.address)).toBe(true);
      }
      // 크롤러는 주소에 필터가 들어 있는지(includes)로 거른다. 한 필터가 다른 필터를 포함하면 지역이 섞인다.
      const filters = rows.map((row) => row[2]);
      for (const a of filters)
        expect(filters.filter((b) => b !== a && b.includes(a))).toEqual([]);
    },
  );

  it('광역시 폴더는 서울 구 폴더 glob `kakao-map/*[^대]구/`에 걸리지 않는다', () => {
    const seoulGlob = /^[^/]*[^대]구$/;
    const sidoFolders = new Set(
      read('metro-area.tsv').map(([folder]) => folder.split('/')[0]),
    );
    expect([...sidoFolders]).toEqual([
      '부산',
      '대구',
      '광주',
      '대전',
      '울산',
      '세종',
    ]);
    expect([...sidoFolders].filter((f) => seoulGlob.test(f))).toEqual([]);
  });
});
