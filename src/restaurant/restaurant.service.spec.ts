import { RestaurantService } from './restaurant.service';
import { RestaurantMenuEntity } from './entity/restaurant-menu.entity';

describe('RestaurantService', () => {
  it('returns sugars and saturated fat in restaurant menu details', () => {
    const service = new RestaurantService(null, null, null, null);
    const menu = {
      id: 1,
      name: '테스트 메뉴',
      calories: '250',
      carbs: '42.1',
      sugars: '6.2',
      protein: '12.3',
      fat: '8.4',
      satFat: '3.1',
      unit: 0,
      weight: '100',
      unitQuantity: '1인분',
    } as unknown as RestaurantMenuEntity;

    const response = (
      service as unknown as {
        toResponse(menu: RestaurantMenuEntity): Record<string, unknown>;
      }
    ).toResponse(menu);

    expect(response).toEqual({
      menu_id: 1,
      menu_name: '테스트 메뉴',
      menu_category: null,
      calories: 250,
      sugars: 6.2,
      protein: 12.3,
      sat_fat: 3.1,
      unit: 0,
      weight: 100,
      unit_quantity: '1인분',
    });
    expect(response).not.toHaveProperty('carbs');
    expect(response).not.toHaveProperty('fat');
  });

  it('returns the menu category for the food card badge', () => {
    const service = new RestaurantService(null, null, null, null);
    const menu = {
      id: 3,
      name: '고구마 피자',
      menuCategory: '피자',
      calories: '258',
      unit: 0,
      weight: '100',
      unitQuantity: '조각',
    } as unknown as RestaurantMenuEntity;

    const response = (
      service as unknown as {
        toResponse(menu: RestaurantMenuEntity): Record<string, unknown>;
      }
    ).toResponse(menu);

    expect(response.menu_category).toBe('피자');
  });

  it('keeps an unavailable restaurant menu weight as null', () => {
    const service = new RestaurantService(null, null, null, null);
    const menu = {
      id: 2,
      name: '중량 미제공 메뉴',
      calories: '500',
      sugars: null,
      protein: null,
      satFat: null,
      unit: 0,
      weight: null,
      unitQuantity: '1인분',
    } as unknown as RestaurantMenuEntity;

    const response = (
      service as unknown as {
        toResponse(menu: RestaurantMenuEntity): Record<string, unknown>;
      }
    ).toResponse(menu);

    expect(response.weight).toBeNull();
  });

  it('limits filtered 지코바치킨 recommendations to two menus', async () => {
    const restaurantRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: '지코바치킨',
        category: '치킨',
      }),
    };
    const menus = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      restaurantId: 1,
      name: `메뉴 ${index + 1}`,
      calories: 100 + index,
      sugars: index,
      protein: 10,
      satFat: 1,
      unit: 0,
      weight: 100,
      unitQuantity: '1조각',
    })) as unknown as RestaurantMenuEntity[];
    const restaurantMenuRepository = {
      find: jest.fn().mockResolvedValue(menus),
    };
    const chatService = {
      recommendRestaurantMenuIds: jest
        .fn()
        .mockResolvedValue(menus.map((menu) => menu.id)),
    };
    const service = new RestaurantService(
      restaurantRepository as never,
      restaurantMenuRepository as never,
      chatService as never,
      null,
    );

    const response = await service.getRestaurantDetail(
      { restaurant_id: 1, filter: 'low_calorie' as never },
      1,
    );

    expect(response.menu_list).toHaveLength(2);
    expect(response.menu_list.map((menu) => menu.menu_id)).toEqual([1, 2]);
  });

  it('excludes beverage menus from filtered recommendations', async () => {
    const restaurantRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: '테스트 버거',
        category: '버거',
      }),
    };
    const menus = [
      {
        id: 1,
        restaurantId: 1,
        name: '아메리카노',
        menuCategory: '커피',
        calories: 5,
        protein: 0,
        unit: 1,
        weight: 355,
        unitQuantity: '1잔',
      },
      {
        id: 2,
        restaurantId: 1,
        name: '샌드위치',
        menuCategory: '푸드',
        calories: 300,
        protein: 15,
        unit: 0,
        weight: 180,
        unitQuantity: '1개',
      },
      {
        id: 3,
        restaurantId: 1,
        name: '치즈 스파게티',
        menuCategory: '스파게티',
        calories: 500,
        protein: 20,
        unit: 0,
        weight: 300,
        unitQuantity: '1인분',
      },
    ] as unknown as RestaurantMenuEntity[];
    const restaurantMenuRepository = {
      find: jest.fn().mockResolvedValue(menus),
    };
    const chatService = {
      recommendRestaurantMenuIds: jest.fn().mockResolvedValue([1, 2, 3]),
    };
    const service = new RestaurantService(
      restaurantRepository as never,
      restaurantMenuRepository as never,
      chatService as never,
      null,
    );

    const response = await service.getRestaurantDetail(
      { restaurant_id: 1, filter: '저칼로리' as never },
      1,
    );

    expect(chatService.recommendRestaurantMenuIds).toHaveBeenCalledWith(
      expect.objectContaining({
        menus: [
          expect.objectContaining({ menu_id: 2 }),
          expect.objectContaining({ menu_id: 3 }),
        ],
      }),
    );
    expect(response.menu_list.map((menu) => menu.menu_id)).toEqual([2, 3]);
  });

  it('keeps beverage menus in cafe recommendations', async () => {
    const restaurantRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: '테스트 카페',
        category: '카페',
      }),
    };
    const menus = [
      {
        id: 1,
        restaurantId: 1,
        name: '아메리카노',
        menuCategory: '커피',
        calories: 5,
        unit: 1,
        weight: 355,
        unitQuantity: '1잔',
      },
    ] as unknown as RestaurantMenuEntity[];
    const restaurantMenuRepository = {
      find: jest.fn().mockResolvedValue(menus),
    };
    const chatService = {
      recommendRestaurantMenuIds: jest.fn().mockResolvedValue([1]),
    };
    const service = new RestaurantService(
      restaurantRepository as never,
      restaurantMenuRepository as never,
      chatService as never,
      null,
    );

    const response = await service.getRestaurantDetail(
      { restaurant_id: 1, filter: '저칼로리' as never },
      1,
    );

    expect(response.menu_list.map((menu) => menu.menu_id)).toEqual([1]);
  });

  it('excludes side menus outside cafe and bakery recommendations', async () => {
    const restaurantRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: '테스트 버거',
        category: '버거',
      }),
    };
    const menus = [
      {
        id: 1,
        restaurantId: 1,
        name: '감자튀김',
        menuCategory: '사이드류',
        calories: 250,
        unit: 0,
        weight: 100,
        unitQuantity: '1개',
      },
      {
        id: 2,
        restaurantId: 1,
        name: '불고기버거',
        menuCategory: '버거',
        calories: 450,
        unit: 0,
        weight: 200,
        unitQuantity: '1개',
      },
    ] as unknown as RestaurantMenuEntity[];
    const restaurantMenuRepository = {
      find: jest.fn().mockResolvedValue(menus),
    };
    const chatService = {
      recommendRestaurantMenuIds: jest.fn().mockResolvedValue([1, 2]),
    };
    const service = new RestaurantService(
      restaurantRepository as never,
      restaurantMenuRepository as never,
      chatService as never,
      null,
    );

    const response = await service.getRestaurantDetail(
      { restaurant_id: 1, filter: '저칼로리' as never },
      1,
    );

    expect(response.menu_list.map((menu) => menu.menu_id)).toEqual([2]);
  });

  it.each([
    ['버거', '소스'],
    ['치킨', '재료 추가'],
    ['피자', '추가 토핑 ®'],
    ['샌드위치/샐러드', '드레싱'],
    ['샌드위치/샐러드', '빵'],
    ['베이커리', '크림'],
  ])('%s 추천에서 %s 구성품을 제외한다', (restaurantCategory, menuCategory) => {
    const service = new RestaurantService(null, null, null, null);
    const menu = { menuCategory } as RestaurantMenuEntity;

    const isCandidate = (
      service as unknown as {
        isRecommendationCandidate(
          menu: RestaurantMenuEntity,
          category: string,
        ): boolean;
      }
    ).isRecommendationCandidate(menu, restaurantCategory);

    expect(isCandidate).toBe(false);
  });

  it('keeps bakery bread and cafe add-ons as recommendation candidates', () => {
    const service = new RestaurantService(null, null, null, null);
    const candidateChecker = service as unknown as {
      isRecommendationCandidate(
        menu: RestaurantMenuEntity,
        category: string,
      ): boolean;
    };

    expect(
      candidateChecker.isRecommendationCandidate(
        { menuCategory: '빵' } as RestaurantMenuEntity,
        '베이커리',
      ),
    ).toBe(true);
    expect(
      candidateChecker.isRecommendationCandidate(
        { menuCategory: '토핑' } as RestaurantMenuEntity,
        '카페',
      ),
    ).toBe(true);
  });

  describe('findRegisteredBrands', () => {
    const branches = [
      {
        kakaoPlaceId: '200',
        restaurantId: 2,
        restaurant: { id: 2, name: '롯데리아' },
      },
      {
        kakaoPlaceId: '100',
        restaurantId: 1,
        restaurant: { id: 1, name: '맘스터치' },
      },
    ];

    it('returns only mapped places in request order without duplicates', async () => {
      const restaurantBranchRepository = {
        find: jest.fn().mockResolvedValue(branches),
      };
      const service = new RestaurantService(
        null,
        null,
        null,
        restaurantBranchRepository as never,
      );

      const response = await service.findRegisteredBrands({
        place_ids: ['100', '999', '200', '100'],
      });

      expect(response).toEqual({
        restaurants: [
          { place_id: 100, restaurant_id: 1, restaurant_name: '맘스터치' },
          { place_id: 200, restaurant_id: 2, restaurant_name: '롯데리아' },
        ],
      });
      const [options] = restaurantBranchRepository.find.mock.calls[0];
      expect(options.where.kakaoPlaceId.value).toEqual(['100', '999', '200']);
      expect(options.relations).toEqual({ restaurant: true });
    });

    it('returns an empty list when nothing is registered', async () => {
      const service = new RestaurantService(null, null, null, {
        find: jest.fn().mockResolvedValue([]),
      } as never);

      await expect(
        service.findRegisteredBrands({ place_ids: ['1'] }),
      ).resolves.toEqual({ restaurants: [] });
    });
  });
});
