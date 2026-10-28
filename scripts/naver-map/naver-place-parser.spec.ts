import { readFileSync } from 'fs';
import { join } from 'path';
import {
  extractApolloState,
  looksBlocked,
  parseMenuPage,
  parseRestaurantList,
} from './naver-place-parser';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

describe('naver-place-parser', () => {
  it('문자열 안의 중괄호·따옴표가 있어도 __APOLLO_STATE__ 객체만 꺼낸다', () => {
    const state = extractApolloState(fixture('restaurant-list.html'));
    expect(state['PlaceListBusinessesItem:1000000002:1000000002'].name).toBe(
      '가상 "따옴표" 식당 {중괄호}',
    );
    expect(state).not.toHaveProperty('__PLACE_STATE__');
    expect(extractApolloState('<html></html>')).toBeNull();
  });

  it('목록 페이지에서 식당 항목만 뽑고 commonAddress의 시·구를 도로명(없으면 지번) 주소 앞에 붙인다', () => {
    expect(parseRestaurantList(fixture('restaurant-list.html'))).toEqual([
      {
        placeId: '1000000001',
        name: '가상 김밥 잠실점',
        address: '서울 송파구 가상로 1 1층',
        category: '분식',
      },
      {
        placeId: '1000000002',
        name: '가상 "따옴표" 식당 {중괄호}',
        address: '서울 송파구 잠실동 2-2',
        category: '한식',
      },
      {
        placeId: '1000000003',
        name: '가상 강남 식당',
        address: '서울 강남구 가상로 3',
        category: '양식',
      },
    ]);
  });

  it('메뉴 페이지에서 추천을 뺀 분류 순서로 메뉴를 뽑고, 첫 사진(없으면 썸네일) URL만 쓴다', () => {
    const page = parseMenuPage(fixture('menu-list.html'), '1000000001');
    expect(page.place).toEqual({
      placeId: '1000000001',
      name: '가상 김밥 잠실점',
      address: '서울 송파구 가상로 1 1층',
      category: '분식',
    });
    expect(page.menus).toEqual([
      {
        name: '기본김밥',
        price: '3,500원',
        imageUrl: 'https://ldb-phinf.pstatic.net/fake/kimbap-1.jpg',
      },
      { name: '참치김밥', price: '5,000원', imageUrl: '' },
      {
        name: '라면, 떡볶이 세트',
        price: '변동',
        imageUrl: 'https://ldb-phinf.pstatic.net/fake/set-thumb.jpg',
      },
      { name: '분류 없는 메뉴', price: '1,000원', imageUrl: '' },
    ]);
  });

  it('메뉴가 없는 식당은 빈 메뉴 목록을 돌려준다', () => {
    const page = parseMenuPage(fixture('menu-empty.html'), '1000000002');
    expect(page.place?.name).toBe('가상 메뉴없는 식당');
    expect(page.menus).toEqual([]);
  });

  it('__APOLLO_STATE__가 없으면 오류를 던진다', () => {
    expect(() => parseRestaurantList(fixture('blocked.html'))).toThrow(
      '__APOLLO_STATE__',
    );
    expect(() => parseMenuPage(fixture('blocked.html'), '1')).toThrow(
      '__APOLLO_STATE__',
    );
  });

  it('접근 제한 안내 페이지를 차단으로 본다', () => {
    expect(looksBlocked(fixture('blocked.html'))).toBe(true);
    expect(looksBlocked(fixture('menu-list.html'))).toBe(false);
  });
});
