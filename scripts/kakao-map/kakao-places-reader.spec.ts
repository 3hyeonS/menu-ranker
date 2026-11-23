import { join } from 'path';
import {
  countUnmatchedBrandSegments,
  KakaoBrandMatcher,
} from './kakao-brand-matcher';
import { readPlaces } from './kakao-places-reader';

const fixturePath = (name: string) => join(__dirname, '__fixtures__', name);

// DB restaurant 이름(brand-nutrition 기준)의 일부. id는 가짜.
const restaurants = [
  { id: 1, name: '롯데리아' },
  { id: 2, name: '메가커피' },
  { id: 3, name: '할리스' },
  { id: 4, name: '스타벅스' },
  { id: 5, name: '매머드커피' },
];

describe('음식점(FD6)·카페(CE7) places.jsonl 함께 매칭', () => {
  const { places, invalidLineCount, duplicateCount } = readPlaces([
    fixturePath('restaurant-places.jsonl'),
    fixturePath('cafe-places.jsonl'),
  ]);
  const matcher = new KakaoBrandMatcher(restaurants);
  const matchById = new Map(
    places.map((place) => [place.id, matcher.match(place)]),
  );

  it('여러 파일을 합치고 같은 장소 id는 앞 파일 것을 쓴다', () => {
    expect(places).toHaveLength(2 + 7);
    expect(duplicateCount).toBe(1);
    expect(invalidLineCount).toBe(0);
    expect(places.find((place) => place.id === '1000001')?.name).toBe(
      '롯데리아 가상잠실점',
    );
  });

  it('카페 카테고리의 카카오 표기를 별칭으로 DB 브랜드에 매칭한다', () => {
    expect(matchById.get('2000001')).toEqual({
      restaurantId: 2,
      source: 'category',
    });
    expect(matchById.get('2000004')).toEqual({
      restaurantId: 3,
      source: 'category',
    });
    expect(matchById.get('2000005')).toEqual({
      restaurantId: 4,
      source: 'category',
    });
    expect(matchById.get('1000001')).toEqual({
      restaurantId: 1,
      source: 'category',
    });
  });

  it('매머드익스프레스는 매머드커피에 매칭하지 않는다(#32 결정)', () => {
    expect(matchById.get('2000006')).toBeNull();
  });

  it('매칭되지 않은 장소 중 장소명에 들어 있는 마지막 카테고리 세그먼트만 많은 순으로 센다', () => {
    const unmatched = places.filter((place) => !matchById.get(place.id));
    expect(countUnmatchedBrandSegments(unmatched, 10)).toEqual([
      ['가상커피', 2],
      ['매머드익스프레스', 1],
    ]);
    expect(countUnmatchedBrandSegments(unmatched, 1)).toEqual([
      ['가상커피', 2],
    ]);
  });
});
