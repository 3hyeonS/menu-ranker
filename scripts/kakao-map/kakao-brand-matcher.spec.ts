import {
  KakaoBrandMatcher,
  KakaoPlace,
  normalizeBrandKey,
  parseKakaoPlaceLine,
} from './kakao-brand-matcher';

const restaurants = [
  { id: 1, name: '롯데리아' },
  { id: 2, name: 'BHC' },
  { id: 3, name: '샐러디' },
  { id: 4, name: '맘스터치' },
  { id: 5, name: '서브웨이' },
  { id: 6, name: '파파이스' },
  { id: 7, name: '앤티앤스 프레즐' },
  { id: 8, name: '할리스' },
];

const place = (name: string, category: string): KakaoPlace => ({
  id: '1',
  name,
  address: null,
  category,
});

describe('KakaoBrandMatcher', () => {
  const matcher = new KakaoBrandMatcher(restaurants);

  it('matches a brand from the kakao category segment', () => {
    expect(
      matcher.match(
        place('롯데리아 잠실새내점', '음식점 > 패스트푸드 > 롯데리아'),
      ),
    ).toEqual({ restaurantId: 1, source: 'category' });
  });

  it('matches category aliases', () => {
    expect(
      matcher.match(place('BHC치킨 시흥점', '음식점 > 치킨 > BHC치킨')),
    ).toEqual({ restaurantId: 2, source: 'category' });
    expect(
      matcher.match(place('써브웨이 잠실점', '음식점 > 패스트푸드 > 써브웨이')),
    ).toEqual({ restaurantId: 5, source: 'category' });
  });

  it('falls back to the first word of the place name', () => {
    expect(
      matcher.match(place('파파이스 강남점', '음식점 > 양식 > 햄버거')),
    ).toEqual({ restaurantId: 6, source: 'name' });
    expect(
      matcher.match(
        place('앤티앤스 이마트 천호점', '음식점 > 간식 > 제과,베이커리'),
      ),
    ).toEqual({ restaurantId: 7, source: 'name' });
  });

  it('does not match a brand by prefix', () => {
    expect(
      matcher.match(place('샐러디아 대림점', '음식점 > 샐러드 > 샐러디아')),
    ).toBeNull();
    expect(
      matcher.match(place('할리스코 마곡점', '음식점 > 양식 > 멕시칸,브라질')),
    ).toBeNull();
  });

  it('skips derived brands even when the first word is a brand', () => {
    expect(
      matcher.match(
        place(
          '맘스터치 피자앤치킨 방배역점',
          '음식점 > 양식 > 피자 > 맘스터치 피자앤치킨',
        ),
      ),
    ).toBeNull();
  });

  it('prefers the database name over an alias of the same group', () => {
    const both = new KakaoBrandMatcher([
      { id: 10, name: '써브웨이' },
      { id: 11, name: '서브웨이' },
    ]);
    expect(
      both.match(place('써브웨이 역삼점', '음식점 > 패스트푸드 > 써브웨이')),
    ).toEqual({ restaurantId: 10, source: 'category' });
  });

  it('ignores unknown places', () => {
    expect(
      matcher.match(place('착한떡볶이', '음식점 > 분식 > 떡볶이')),
    ).toBeNull();
  });
});

describe('normalizeBrandKey', () => {
  it('removes spaces and symbols and lowercases', () => {
    expect(normalizeBrandKey(' 앤티앤스 프레즐 ')).toBe('앤티앤스프레즐');
    expect(normalizeBrandKey('BHC-치킨')).toBe('bhc치킨');
  });
});

describe('parseKakaoPlaceLine', () => {
  it('parses a places.jsonl line', () => {
    expect(
      parseKakaoPlaceLine(
        '{"id":"21605481","name":"착한떡볶이","address":"서울 송파구 충민로 5","category":"음식점 > 분식 > 떡볶이"}',
      ),
    ).toEqual({
      id: '21605481',
      name: '착한떡볶이',
      address: '서울 송파구 충민로 5',
      category: '음식점 > 분식 > 떡볶이',
    });
  });

  it('returns null for blank lines or rows without a numeric id', () => {
    expect(parseKakaoPlaceLine('  ')).toBeNull();
    expect(parseKakaoPlaceLine('{"id":"abc","name":"x"}')).toBeNull();
    expect(parseKakaoPlaceLine('{"id":"1","name":""}')).toBeNull();
  });
});
