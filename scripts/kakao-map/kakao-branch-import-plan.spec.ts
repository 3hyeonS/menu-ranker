import { parseCsv } from '../crawl-common/crawl-files';
import {
  BranchFolderInput,
  parseMenuRows,
  parseRestaurantRows,
  planBranchImport,
  toHttpsPhotoUrl,
} from './kakao-branch-import-plan';
import { KakaoBrandMatcher, KakaoPlace } from './kakao-brand-matcher';

const matcher = new KakaoBrandMatcher([
  { id: 1, name: '롯데리아' },
  { id: 2, name: '파리바게뜨' },
]);

const place = (
  id: string,
  name: string,
  category: string | null = '음식점 > 한식',
): KakaoPlace => ({ id, name, address: `주소 ${id}`, category });

const none: ReadonlySet<string> = new Set();

const csvPlace = (id: string, name: string): KakaoPlace => ({
  id,
  name,
  address: `주소 ${id}`,
  category: null,
});

describe('planBranchImport', () => {
  it('imports every restaurants.csv place and brand places outside it', () => {
    const folders: BranchFolderInput[] = [
      {
        places: [
          place('1', '롯데리아 잠실점', '음식점 > 패스트푸드 > 롯데리아'),
          place('2', '착한떡볶이', '음식점 > 분식'),
          // 제외 카테고리라 restaurants.csv에는 없지만 브랜드에 매칭된다.
          place('3', '파리바게뜨 송파점', '음식점 > 간식 > 제과,베이커리'),
          // 제외 카테고리이고 브랜드도 아니다.
          place('4', '동네카페', '음식점 > 카페'),
        ],
        restaurants: [
          csvPlace('1', '롯데리아 잠실점'),
          csvPlace('2', '착한떡볶이'),
          // 메뉴 수집이 실패해 menu-done.txt에 없다.
          csvPlace('5', '수집실패식당'),
        ],
        menuDoneIds: new Set(['1', '2']),
      },
    ];

    const plan = planBranchImport(folders, matcher);

    expect(
      plan.targets.map((target) => ({
        id: target.place.id,
        restaurantId: target.restaurantId,
        matchSource: target.matchSource,
        listed: target.listed,
        menusCollected: target.menusCollected,
      })),
    ).toEqual([
      {
        id: '1',
        restaurantId: 1,
        matchSource: 'category',
        listed: true,
        menusCollected: true,
      },
      {
        id: '2',
        restaurantId: null,
        matchSource: null,
        listed: true,
        menusCollected: true,
      },
      {
        id: '3',
        restaurantId: 2,
        matchSource: 'name',
        listed: false,
        menusCollected: false,
      },
      {
        id: '5',
        restaurantId: null,
        matchSource: null,
        listed: true,
        menusCollected: false,
      },
    ]);
    // 카테고리는 places.jsonl 값을 쓴다.
    expect(plan.targets[1].place.category).toBe('음식점 > 분식');
    expect(plan.unlinkPlaceIds).toEqual(['4']);
  });

  it('keeps the first place and reads menus from the restaurants.csv folder', () => {
    const folders: BranchFolderInput[] = [
      { places: [place('1', '경계식당')], restaurants: [], menuDoneIds: none },
      {
        places: [place('1', '경계식당(중복)')],
        restaurants: [csvPlace('1', '경계식당')],
        menuDoneIds: new Set(['1']),
      },
      {
        places: [],
        restaurants: [csvPlace('1', '경계식당(중복)')],
        menuDoneIds: none,
      },
    ];

    const plan = planBranchImport(folders, matcher);

    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0].place.name).toBe('경계식당');
    expect(plan.targets[0].folderIndex).toBe(1);
    // 메뉴를 읽는 폴더(1)의 menu-done.txt로 판단한다.
    expect(plan.targets[0].menusCollected).toBe(true);
    expect(plan.duplicatePlaceCount).toBe(1);
    expect(plan.duplicateRestaurantCount).toBe(1);
  });

  it('uses the restaurants.csv row when places.jsonl lacks the place', () => {
    const plan = planBranchImport(
      [
        {
          places: [],
          restaurants: [csvPlace('9', '롯데리아 신규점')],
          menuDoneIds: new Set(['9']),
        },
      ],
      matcher,
    );

    expect(plan.targets).toEqual([
      {
        place: csvPlace('9', '롯데리아 신규점'),
        restaurantId: 1,
        matchSource: 'name',
        folderIndex: 0,
        listed: true,
        menusCollected: true,
      },
    ]);
  });

  it('skips places too long for the columns and drops long optional text', () => {
    const plan = planBranchImport(
      [
        {
          places: [
            place('1', '가'.repeat(256)),
            place('1'.repeat(21), '긴아이디식당'),
            { ...place('3', '긴주소식당'), address: '주'.repeat(256) },
          ],
          restaurants: [],
          menuDoneIds: none,
        },
      ],
      new KakaoBrandMatcher([{ id: 1, name: '긴주소식당' }]),
    );

    expect(plan.oversizedPlaceCount).toBe(2);
    expect(plan.targets.map((target) => target.place)).toEqual([
      { ...place('3', '긴주소식당'), address: null },
    ]);
  });
});

describe('parseRestaurantRows', () => {
  it('parses rows and counts invalid ones', () => {
    const rows = parseCsv(
      '장소id,식당명,주소\r\n1,"김밥, 떡볶이",서울 송파구\r\nabc,이름,\r\n2,,주소\r\n3,국수집,\r\n',
    );

    expect(parseRestaurantRows(rows)).toEqual({
      restaurants: [
        {
          id: '1',
          name: '김밥, 떡볶이',
          address: '서울 송파구',
          category: null,
        },
        { id: '3', name: '국수집', address: null, category: null },
      ],
      invalidRowCount: 2,
    });
  });

  it('rejects an unexpected header', () => {
    expect(() => parseRestaurantRows([['id', 'name', 'address']])).toThrow(
      'restaurants.csv 헤더가 다릅니다',
    );
  });
});

describe('parseMenuRows', () => {
  it('groups menus by place in file order and upgrades photo urls to https', () => {
    const rows = parseCsv(
      [
        '메뉴명,사진URL,식당id',
        '우육탕면,http://t1.kakaocdn.net/mystore/A,10',
        '"김밥, 라면",,20',
        '우육탕면,https://t1.kakaocdn.net/mystore/B,10',
        ',http://t1.kakaocdn.net/mystore/C,10',
        `긴사진,https://t1.kakaocdn.net/${'x'.repeat(600)},20`,
        `${'가'.repeat(256)},,20`,
        '번호없음,,',
      ].join('\r\n'),
    );

    const parsed = parseMenuRows(rows);

    expect([...parsed.menusByPlaceId.entries()]).toEqual([
      [
        '10',
        [
          { name: '우육탕면', photoUrl: 'https://t1.kakaocdn.net/mystore/A' },
          // 같은 식당의 같은 메뉴명도 카카오 원본처럼 둘 다 둔다.
          { name: '우육탕면', photoUrl: 'https://t1.kakaocdn.net/mystore/B' },
        ],
      ],
      [
        '20',
        [
          { name: '김밥, 라면', photoUrl: null },
          { name: '긴사진', photoUrl: null },
        ],
      ],
    ]);
    expect(parsed.menuCount).toBe(4);
    expect(parsed.invalidRowCount).toBe(3);
    expect(parsed.droppedPhotoCount).toBe(1);
  });

  it('rejects an unexpected header', () => {
    expect(() => parseMenuRows([['메뉴명', '식당id']])).toThrow(
      'menus.csv 헤더가 다릅니다',
    );
  });
});

describe('toHttpsPhotoUrl', () => {
  it.each([
    ['http://t1.kakaocdn.net/a', 'https://t1.kakaocdn.net/a'],
    ['HTTP://cfile2.uf.tistory.com/a', 'https://cfile2.uf.tistory.com/a'],
    [
      'https://place-static.tossplace.com/a',
      'https://place-static.tossplace.com/a',
    ],
    ['  ', null],
  ])('%s -> %s', (input, expected) => {
    expect(toHttpsPhotoUrl(input)).toBe(expected);
  });
});
