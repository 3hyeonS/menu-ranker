import { IsNull, MoreThanOrEqual, Not } from 'typeorm';
import {
  isBranchNonMealMenuName,
  RestaurantService,
} from './restaurant.service';
import { RestaurantMenuEntity } from './entity/restaurant-menu.entity';

const userContext = {
  user_profile: { goal: '감량' },
  long_term_profile_traits: null,
  recent_meal_records_3_days: [],
};

function createChatService(
  rankings: Partial<Record<'균형' | '저칼로리' | '단백질', number[]>>,
) {
  return {
    getRestaurantRecommendationUserContext: jest
      .fn()
      .mockResolvedValue(userContext),
    rankRestaurantMenusByFilter: jest
      .fn()
      .mockResolvedValue({ 균형: [], 저칼로리: [], 단백질: [], ...rankings }),
  };
}

describe('RestaurantService', () => {
  it('returns sugars and saturated fat in restaurant menu details', () => {
    const service = new RestaurantService(null, null, null, null, null, null);
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
    const service = new RestaurantService(null, null, null, null, null, null);
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
    const service = new RestaurantService(null, null, null, null, null, null);
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
    const chatService = createChatService({
      저칼로리: menus.map((menu) => menu.id),
    });
    const service = new RestaurantService(
      restaurantRepository as never,
      restaurantMenuRepository as never,
      chatService as never,
      null,
      null,
      null,
    );

    const response = await service.getRestaurantDetail(
      { restaurant_id: 1, filter: '저칼로리' as never },
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
    const chatService = createChatService({ 저칼로리: [1, 2, 3] });
    const service = new RestaurantService(
      restaurantRepository as never,
      restaurantMenuRepository as never,
      chatService as never,
      null,
      null,
      null,
    );

    const response = await service.getRestaurantDetail(
      { restaurant_id: 1, filter: '저칼로리' as never },
      1,
    );

    expect(chatService.rankRestaurantMenusByFilter).toHaveBeenCalledWith(
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
    const chatService = createChatService({ 저칼로리: [1] });
    const service = new RestaurantService(
      restaurantRepository as never,
      restaurantMenuRepository as never,
      chatService as never,
      null,
      null,
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
    const chatService = createChatService({ 저칼로리: [1, 2] });
    const service = new RestaurantService(
      restaurantRepository as never,
      restaurantMenuRepository as never,
      chatService as never,
      null,
      null,
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
    ['도시락', '소스'],
    ['도시락', '미니반찬&집반찬'],
    ['도시락', '미니반찬 & 집반찬'],
    ['도시락', '밥'],
    ['도시락', '스낵'],
    ['도시락', '디저트'],
  ])('%s 추천에서 %s 구성품을 제외한다', (restaurantCategory, menuCategory) => {
    const service = new RestaurantService(null, null, null, null, null, null);
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

  it.each([
    ['도시락', '단품/실속반찬'],
    ['도시락', '덮밥'],
    ['도시락', '정식'],
    ['도시락', '볶음밥'],
    ['버거', '버거'],
    ['치킨', '치킨'],
    ['샌드위치/샐러드', '샐러드'],
  ])(
    '%s 추천에서 %s 메뉴는 후보로 남긴다',
    (restaurantCategory, menuCategory) => {
      const service = new RestaurantService(null, null, null, null, null, null);
      const menu = { menuCategory } as RestaurantMenuEntity;

      const isCandidate = (
        service as unknown as {
          isRecommendationCandidate(
            menu: RestaurantMenuEntity,
            category: string,
          ): boolean;
        }
      ).isRecommendationCandidate(menu, restaurantCategory);

      expect(isCandidate).toBe(true);
    },
  );

  it('keeps bakery bread and cafe add-ons as recommendation candidates', () => {
    const service = new RestaurantService(null, null, null, null, null, null);
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

  describe('filter recommendations', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleError.mockRestore();
    });

    function createMenus(count: number): RestaurantMenuEntity[] {
      return Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        restaurantId: 1,
        name: `메뉴 ${index + 1}`,
        menuCategory: '버거',
        calories: 100 * (index + 1),
        carbs: 30,
        protein: 30 - index,
        fat: 10,
        unit: 0,
        weight: 200,
        unitQuantity: '1개',
      })) as unknown as RestaurantMenuEntity[];
    }

    function createService(
      menus: RestaurantMenuEntity[],
      chatService: ReturnType<typeof createChatService>,
    ) {
      return new RestaurantService(
        {
          findOne: jest.fn().mockResolvedValue({
            id: 1,
            name: '테스트 버거',
            category: '버거',
          }),
        } as never,
        { find: jest.fn().mockResolvedValue(menus) } as never,
        chatService as never,
        null,
        null,
        null,
      );
    }

    async function recommend(service: RestaurantService, filter: string) {
      const response = await service.getRestaurantDetail(
        { restaurant_id: 1, filter: filter as never },
        1,
      );
      return response.menu_list.map((menu) => menu.menu_id);
    }

    it('removes duplicates across filters in 저칼로리 > 단백질 > 균형 order', async () => {
      const menus = createMenus(15);
      const chatService = createChatService({
        저칼로리: [1, 2, 3, 4, 5, 6],
        단백질: [1, 2, 7, 8, 9, 10, 11],
        균형: [1, 7, 12, 13, 14, 15, 2],
      });
      const service = createService(menus, chatService);

      expect(await recommend(service, '저칼로리')).toEqual([1, 2, 3, 4, 5]);
      expect(await recommend(service, '단백질')).toEqual([7, 8, 9, 10, 11]);
      expect(await recommend(service, '균형')).toEqual([12, 13, 14, 15, 6]);
    });

    it('reuses the cached result for the same record and recalculates when it changes', async () => {
      const menus = createMenus(15);
      const chatService = createChatService({ 저칼로리: [3, 1, 2] });
      const service = createService(menus, chatService);

      const first = await recommend(service, '저칼로리');
      await recommend(service, '단백질');
      await recommend(service, '균형');
      expect(await recommend(service, '저칼로리')).toEqual(first);
      expect(chatService.rankRestaurantMenusByFilter).toHaveBeenCalledTimes(1);

      chatService.getRestaurantRecommendationUserContext.mockResolvedValue({
        ...userContext,
        recent_meal_records_3_days: [{ date: '2026-11-02' }],
      });
      await recommend(service, '저칼로리');
      expect(chatService.rankRestaurantMenusByFilter).toHaveBeenCalledTimes(2);
    });

    it('shares one Gemini call between concurrent filter requests', async () => {
      const chatService = createChatService({});
      const service = createService(createMenus(15), chatService);

      await Promise.all([
        recommend(service, '저칼로리'),
        recommend(service, '단백질'),
        recommend(service, '균형'),
      ]);

      expect(chatService.rankRestaurantMenusByFilter).toHaveBeenCalledTimes(1);
    });

    it('fills short filters with duplicates when candidates run out', async () => {
      const menus = createMenus(6);
      const chatService = createChatService({
        저칼로리: [1, 2, 3, 4, 5],
        단백질: [6, 1, 2, 3, 4],
        균형: [2, 6, 1, 3, 5],
      });
      const service = createService(menus, chatService);

      expect(await recommend(service, '저칼로리')).toEqual([1, 2, 3, 4, 5]);
      expect(await recommend(service, '단백질')).toEqual([6, 1, 2, 3, 4]);
      expect(await recommend(service, '균형')).toEqual([2, 6, 1, 3, 5]);
    });

    it('fills a short Gemini ranking with the rule-based ranking', async () => {
      const menus = createMenus(15);
      const chatService = createChatService({ 저칼로리: [9, 99] });
      const service = createService(menus, chatService);

      expect(await recommend(service, '저칼로리')).toEqual([9, 1, 2, 3, 4]);
    });

    it('uses rule-based rankings without caching when Gemini fails', async () => {
      const menus = createMenus(15);
      const chatService = createChatService({});
      chatService.rankRestaurantMenusByFilter.mockRejectedValueOnce(
        new Error('Gemini unavailable'),
      );
      const service = createService(menus, chatService);

      expect(await recommend(service, '저칼로리')).toEqual([1, 2, 3, 4, 5]);
      expect(await recommend(service, '단백질')).toEqual([6, 7, 8, 9, 10]);
      expect(chatService.rankRestaurantMenusByFilter).toHaveBeenCalledTimes(2);
    });

    it('does not cache a Gemini reply without any usable ranking', async () => {
      const chatService = createChatService({});
      const service = createService(createMenus(15), chatService);

      expect(await recommend(service, '저칼로리')).toEqual([1, 2, 3, 4, 5]);
      await recommend(service, '저칼로리');
      expect(chatService.rankRestaurantMenusByFilter).toHaveBeenCalledTimes(2);
    });

    it('rethrows request cancellation instead of falling back', async () => {
      const chatService = createChatService({});
      const canceled = Object.assign(new Error('canceled'), {
        name: 'CanceledError',
      });
      chatService.rankRestaurantMenusByFilter.mockRejectedValueOnce(canceled);
      const service = createService(createMenus(15), chatService);

      await expect(recommend(service, '저칼로리')).rejects.toBe(canceled);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('recalculates when the request that started the shared call is canceled', async () => {
      const chatService = createChatService({ 저칼로리: [9] });
      const canceled = Object.assign(new Error('canceled'), {
        name: 'CanceledError',
      });
      chatService.rankRestaurantMenusByFilter.mockRejectedValueOnce(canceled);
      const service = createService(createMenus(15), chatService);

      const [first, second] = await Promise.allSettled([
        recommend(service, '저칼로리'),
        recommend(service, '단백질'),
      ]);

      expect(first).toEqual({ status: 'rejected', reason: canceled });
      // 저칼로리가 9·1·2·3·4를 먼저 차지해 단백질은 남은 메뉴에서 고른다.
      expect(second).toEqual({
        status: 'fulfilled',
        value: [5, 6, 7, 8, 10],
      });
      expect(chatService.rankRestaurantMenusByFilter).toHaveBeenCalledTimes(2);
    });

    it('uses rule-based rankings when the user context cannot be loaded', async () => {
      const chatService = createChatService({});
      chatService.getRestaurantRecommendationUserContext.mockRejectedValue(
        new Error('User profile is required for recommendation'),
      );
      const service = createService(createMenus(15), chatService);

      expect(await recommend(service, '저칼로리')).toEqual([1, 2, 3, 4, 5]);
      expect(chatService.rankRestaurantMenusByFilter).not.toHaveBeenCalled();
    });
  });

  describe('findRegisteredBrands', () => {
    const branches = [
      {
        id: 20,
        kakaoPlaceId: '200',
        placeName: '롯데리아 잠실새내점',
        restaurantId: 2,
        restaurant: { id: 2, name: '롯데리아' },
      },
      {
        id: 30,
        kakaoPlaceId: '300',
        placeName: '논현 김밥천국',
        restaurantId: null,
        restaurant: null,
      },
      {
        id: 10,
        kakaoPlaceId: '100',
        placeName: '맘스터치 문정점',
        restaurantId: 1,
        restaurant: { id: 1, name: '맘스터치' },
      },
    ];

    function createService(
      rows: unknown[],
      options: {
        branchMenus?: unknown[];
        estimates?: unknown[];
        estimateError?: Error;
      } = {},
    ) {
      const restaurantBranchRepository = {
        find: jest.fn().mockResolvedValue(rows),
      };
      const restaurantBranchMenuRepository = {
        find: jest.fn().mockResolvedValue(options.branchMenus ?? []),
      };
      const menuNutritionEstimateRepository = {
        find: options.estimateError
          ? jest.fn().mockRejectedValue(options.estimateError)
          : jest.fn().mockResolvedValue(options.estimates ?? []),
      };
      const service = new RestaurantService(
        null,
        null,
        null,
        restaurantBranchRepository as never,
        restaurantBranchMenuRepository as never,
        menuNutritionEstimateRepository as never,
      );
      return {
        service,
        restaurantBranchRepository,
        restaurantBranchMenuRepository,
        menuNutritionEstimateRepository,
      };
    }

    it('returns franchise and independent places in request order without duplicates', async () => {
      const { service, restaurantBranchRepository } = createService(branches);

      const response = await service.findRegisteredBrands({
        place_ids: ['100', '999', '300', '200', '100'],
      });

      expect(response).toEqual({
        restaurants: [
          { place_id: 100, restaurant_id: 1, restaurant_name: '맘스터치' },
          {
            place_id: 300,
            restaurant_id: null,
            restaurant_name: '논현 김밥천국',
          },
          { place_id: 200, restaurant_id: 2, restaurant_name: '롯데리아' },
        ],
      });
      const [options] = restaurantBranchRepository.find.mock.calls[0];
      // 브랜드 매핑 지점 OR 개인 식당(match_source도 NULL). 매핑이 끊긴 지점은 뺀다.
      const [mapped, independent] = options.where;
      expect(mapped.kakaoPlaceId.value).toEqual(['100', '999', '300', '200']);
      expect(mapped.restaurantId).toEqual(Not(IsNull()));
      expect(independent.kakaoPlaceId.value).toEqual([
        '100',
        '999',
        '300',
        '200',
      ]);
      expect(independent.restaurantId).toEqual(IsNull());
      expect(independent.matchSource).toEqual(IsNull());
      expect(options.relations).toEqual({ restaurant: true });
      expect(options.select).toEqual(
        expect.objectContaining({ placeName: true }),
      );
    });

    it('gives a virtual restaurant_id to independent places with a displayable estimate', async () => {
      const independent = {
        id: 40,
        kakaoPlaceId: '400',
        placeName: '옥된장 논현점',
        restaurantId: null,
        restaurant: null,
      };
      const {
        service,
        restaurantBranchMenuRepository,
        menuNutritionEstimateRepository,
      } = createService([...branches, independent], {
        branchMenus: [
          { id: 1, branchId: 30, name: '포장비' },
          { id: 2, branchId: 40, name: '김치찌개(대)' },
          { id: 3, branchId: 40, name: '김치 찌개' },
        ],
        estimates: [{ id: 9, normalizedName: '김치찌개', calories: '450' }],
      });

      const response = await service.findRegisteredBrands({
        place_ids: ['300', '400', '200'],
      });

      expect(response.restaurants).toEqual([
        {
          place_id: 300,
          restaurant_id: null,
          restaurant_name: '논현 김밥천국',
        },
        {
          place_id: 400,
          restaurant_id: 100_000_040,
          restaurant_name: '옥된장 논현점',
        },
        { place_id: 200, restaurant_id: 2, restaurant_name: '롯데리아' },
      ]);
      // 개인 식당 지점 메뉴만 읽고, 정규화 이름을 중복 없이 한 번에 조회한다.
      const [menuOptions] = restaurantBranchMenuRepository.find.mock.calls[0];
      expect(menuOptions.where.branchId.value).toEqual([30, 40]);
      const [estimateOptions] =
        menuNutritionEstimateRepository.find.mock.calls[0];
      expect(estimateOptions.where.normalizedName.value).toEqual([
        '포장비',
        '김치찌개',
      ]);
      expect(estimateOptions.where.calories).toEqual(Not(IsNull()));
      expect(estimateOptions.where.confidence).toEqual(MoreThanOrEqual(0.6));
    });

    it('does not look up estimates when every place is a franchise', async () => {
      const { service, restaurantBranchMenuRepository } = createService([
        branches[0],
      ]);

      await service.findRegisteredBrands({ place_ids: ['200'] });

      expect(restaurantBranchMenuRepository.find).not.toHaveBeenCalled();
    });

    it('keeps restaurant_id null when the estimate lookup fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { service } = createService(branches, {
        branchMenus: [{ id: 1, branchId: 30, name: '김밥' }],
        estimateError: new Error(
          "Table 'restaurant_menu_nutrition_estimate' doesn't exist",
        ),
      });

      const response = await service.findRegisteredBrands({
        place_ids: ['300'],
      });

      expect(response.restaurants).toEqual([
        {
          place_id: 300,
          restaurant_id: null,
          restaurant_name: '논현 김밥천국',
        },
      ]);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('returns an empty list when no place is collected', async () => {
      const { service } = createService([]);

      await expect(
        service.findRegisteredBrands({ place_ids: ['1'] }),
      ).resolves.toEqual({ restaurants: [] });
    });
  });

  describe('isBranchNonMealMenuName', () => {
    it.each([
      '라유소스',
      '덮밥용 소이소스',
      '오리엔탈 드레싱',
      '치즈버터 시즈닝',
      '치즈 토핑',
      '모듬반찬',
      '맛김치',
      '볶음김치',
      '깍두기',
      '단무지',
      '오이피클',
      '양파장아찌',
      '생와사비',
      '토마토 케찹',
      '케첩',
      '머스타드',
      '쌈장',
      '일회용 참기름',
      '공깃밥',
      '공기밥(추가)',
      '콜라 500ml',
      '라면사리',
      '반찬 3종',
      '치킨무',
      '한솥 조미김',
      '현미밥',
      '양념간장',
      '초고추장',
      '초장',
      '마요네즈',
    ])('%s는 추천 후보에서 뺀다', (menuName) => {
      expect(isBranchNonMealMenuName(menuName)).toBe(true);
    });

    it.each([
      '김치찌개',
      '김치볶음밥',
      '김치전',
      '두부김치',
      '소스돈까스',
      '반찬정식',
      '참치마요덮밥',
      '제육볶음',
      '김밥',
      '보리밥',
      '간장게장',
      '고추장불고기',
      '참치마요',
    ])('%s는 추천 후보로 남긴다', (menuName) => {
      expect(isBranchNonMealMenuName(menuName)).toBe(false);
    });
  });

  describe('getRestaurantDetail for an independent place', () => {
    const branch = {
      id: 40,
      placeName: '옥된장 논현점',
      kakaoCategory: '음식점 > 한식 > 찌개,전골',
    };
    const estimate = (normalizedName: string, calories: string) => ({
      id: 1,
      normalizedName,
      calories,
      carbs: '30',
      protein: '20',
      fat: '10',
      sugars: '3',
      satFat: '2',
      unit: 0,
      weight: '450',
      unitQuantity: '인분',
    });

    function createService(
      found: unknown,
      branchMenus: unknown[],
      estimates: unknown[],
      chatService = createChatService({}),
    ) {
      const restaurantRepository = { findOne: jest.fn() };
      const restaurantBranchRepository = {
        findOne: jest.fn().mockResolvedValue(found),
      };
      const restaurantBranchMenuRepository = {
        find: jest.fn().mockResolvedValue(branchMenus),
      };
      const menuNutritionEstimateRepository = {
        find: jest.fn().mockResolvedValue(estimates),
      };
      const service = new RestaurantService(
        restaurantRepository as never,
        null,
        chatService as never,
        restaurantBranchRepository as never,
        restaurantBranchMenuRepository as never,
        menuNutritionEstimateRepository as never,
      );
      return {
        service,
        chatService,
        restaurantRepository,
        restaurantBranchRepository,
      };
    }

    it('returns only menus with a displayable estimate in kakao order', async () => {
      const { service, restaurantRepository, restaurantBranchRepository } =
        createService(
          branch,
          [
            { id: 5, name: '된장찌개' },
            { id: 6, name: '포장비' },
            { id: 7, name: '김치찌개(대)' },
          ],
          [estimate('김치찌개', '480'), estimate('된장찌개', '420.5')],
        );

      const response = await service.getRestaurantDetail(
        { restaurant_id: 100_000_040 },
        1,
      );

      expect(response).toEqual({
        restaurant_name: '옥된장 논현점',
        menu_list: [
          {
            menu_id: 100_000_005,
            menu_name: '된장찌개',
            menu_category: null,
            calories: 420.5,
            sugars: 3,
            protein: 20,
            sat_fat: 2,
            unit: 0,
            weight: 450,
            unit_quantity: '인분',
          },
          expect.objectContaining({
            menu_id: 100_000_007,
            menu_name: '김치찌개(대)',
            calories: 480,
          }),
        ],
      });
      expect(restaurantRepository.findOne).not.toHaveBeenCalled();
      const [branchOptions] = restaurantBranchRepository.findOne.mock.calls[0];
      // 개인 식당(브랜드 매핑이 없고 끊긴 매핑도 아님)만 연다.
      expect(branchOptions.where).toEqual({
        id: 40,
        restaurantId: IsNull(),
        matchSource: IsNull(),
      });
    });

    it('throws 404 when the virtual id does not point to an independent place', async () => {
      const { service } = createService(null, [], []);

      await expect(
        service.getRestaurantDetail({ restaurant_id: 100_000_999 }, 1),
      ).rejects.toThrow('Restaurant not found');
    });

    it('recommends estimated meals and excludes drinks and add-ons by name', async () => {
      const chatService = createChatService({
        저칼로리: [100_000_002, 100_000_001],
        단백질: [100_000_001],
        균형: [100_000_001],
      });
      const { service } = createService(
        branch,
        [
          { id: 1, name: '제육볶음' },
          { id: 2, name: '순두부찌개' },
          { id: 3, name: '콜라 500ml' },
          { id: 4, name: '공기밥' },
          { id: 5, name: '딸기스무디' },
        ],
        [
          estimate('제육볶음', '650'),
          estimate('순두부찌개', '380'),
          estimate('콜라', '210'),
          estimate('공기밥', '300'),
          estimate('딸기스무디', '250'),
        ],
        chatService,
      );

      const response = await service.getRestaurantDetail(
        { restaurant_id: 100_000_040, filter: '저칼로리' as never },
        7,
      );

      expect(response.menu_list.map((menu) => menu.menu_name)).toEqual([
        '순두부찌개',
        '제육볶음',
      ]);
      const [params] = chatService.rankRestaurantMenusByFilter.mock.calls[0];
      expect(params.restaurantName).toBe('옥된장 논현점');
      expect(params.restaurantCategory).toBe('한식 > 찌개,전골');
      expect(params.menus.map((menu) => menu.menu_id)).toEqual([
        100_000_001, 100_000_002,
      ]);
    });

    it('returns an empty list when no menu has a displayable estimate', async () => {
      const { service, chatService } = createService(
        branch,
        [{ id: 1, name: '오늘의 메뉴' }],
        [],
      );

      await expect(
        service.getRestaurantDetail(
          { restaurant_id: 100_000_040, filter: '균형' as never },
          1,
        ),
      ).resolves.toEqual({ restaurant_name: '옥된장 논현점', menu_list: [] });
      expect(chatService.rankRestaurantMenusByFilter).not.toHaveBeenCalled();
    });
  });

  describe('findPlace', () => {
    function createService(branch: unknown, menus: unknown[] = []) {
      const restaurantBranchRepository = {
        findOne: jest.fn().mockResolvedValue(branch),
      };
      const restaurantBranchMenuRepository = {
        find: jest.fn().mockResolvedValue(menus),
      };
      const service = new RestaurantService(
        null,
        null,
        null,
        restaurantBranchRepository as never,
        restaurantBranchMenuRepository as never,
        null,
      );
      return {
        service,
        restaurantBranchRepository,
        restaurantBranchMenuRepository,
      };
    }

    it('returns kakao menus in display order with the brand mapping', async () => {
      const {
        service,
        restaurantBranchRepository,
        restaurantBranchMenuRepository,
      } = createService(
        {
          id: 7,
          kakaoPlaceId: '27531028',
          placeName: '롯데리아 잠실새내점',
          address: '서울 송파구 백제고분로 1',
          restaurant: { id: 2, name: '롯데리아' },
        },
        [
          { id: 10, name: '불고기버거', photoUrl: 'https://t1.kakaocdn.net/a' },
          { id: 11, name: '치즈스틱', photoUrl: null },
        ],
      );

      await expect(
        service.findPlace({ place_id: '27531028' }),
      ).resolves.toEqual({
        place_id: 27531028,
        place_name: '롯데리아 잠실새내점',
        address: '서울 송파구 백제고분로 1',
        restaurant_id: 2,
        restaurant_name: '롯데리아',
        menu_list: [
          { menu_name: '불고기버거', photo_url: 'https://t1.kakaocdn.net/a' },
          { menu_name: '치즈스틱', photo_url: null },
        ],
      });
      const [branchOptions] = restaurantBranchRepository.findOne.mock.calls[0];
      expect(branchOptions.where).toEqual({ kakaoPlaceId: '27531028' });
      const [menuOptions] = restaurantBranchMenuRepository.find.mock.calls[0];
      expect(menuOptions.where).toEqual({ branchId: 7 });
      expect(menuOptions.order).toEqual({ sortOrder: 'ASC' });
    });

    it('returns null brand fields for an independent restaurant', async () => {
      const { service } = createService({
        id: 8,
        kakaoPlaceId: '21605481',
        placeName: '착한떡볶이',
        address: null,
        restaurant: null,
      });

      await expect(
        service.findPlace({ place_id: '21605481' }),
      ).resolves.toEqual({
        place_id: 21605481,
        place_name: '착한떡볶이',
        address: null,
        restaurant_id: null,
        restaurant_name: null,
        menu_list: [],
      });
    });

    it('throws 404 for a place that was not collected', async () => {
      const { service, restaurantBranchMenuRepository } = createService(null);

      await expect(service.findPlace({ place_id: '1' })).rejects.toThrow(
        'Place not found',
      );
      expect(restaurantBranchMenuRepository.find).not.toHaveBeenCalled();
    });
  });
});
