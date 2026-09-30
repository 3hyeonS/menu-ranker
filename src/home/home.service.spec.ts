import { HomeService } from './home.service';

describe('HomeService menu search priority', () => {
  const service = Object.create(HomeService.prototype) as any;

  it('prioritizes 포도(샤인머스캣) only for a 샤인머스캣 search', () => {
    const grape = { name: '(식약처_음식) 포도(샤인머스캣)' };
    const jelly = { name: '코코로 구미 젤리 샤인머스캣맛' };

    expect(
      service.isPreferredShineMuscatSearchResult(grape, '샤인머스캣'),
    ).toBe(true);
    expect(
      service.isPreferredShineMuscatSearchResult(jelly, '샤인머스캣'),
    ).toBe(false);
    expect(service.isPreferredShineMuscatSearchResult(grape, '포도')).toBe(
      false,
    );
  });

  it('adds the preferred grape menu to the exact candidate query', () => {
    expect(
      service.getPreferredShineMuscatNameCandidates('샤인 머스캣'),
    ).toContain('(식약처_음식) 포도(샤인머스캣)');
    expect(service.getPreferredShineMuscatNameCandidates('청포도')).toEqual([]);
  });

  it('prioritizes the public steamed-corn menu for an 옥수수 search', () => {
    const steamedCorn = { name: '(식약처_음식) 찐옥수수' };
    const cornDonut = { name: '(식약처_음식) 옥수수찹쌀 도넛' };

    expect(
      service.isPreferredSteamedCornSearchResult(steamedCorn, '옥수수'),
    ).toBe(true);
    expect(
      service.isPreferredSteamedCornSearchResult(cornDonut, '옥수수'),
    ).toBe(false);
    expect(
      service.isPreferredSteamedCornSearchResult(steamedCorn, '옥수수 도넛'),
    ).toBe(false);
  });

  it('adds the preferred steamed-corn menu to the exact candidate query', () => {
    expect(service.getPreferredSteamedCornNameCandidates('옥수수')).toContain(
      '(식약처_음식) 찐옥수수',
    );
    expect(
      service.getPreferredSteamedCornNameCandidates('옥수수 도넛'),
    ).toEqual([]);
  });

  it('prioritizes refined salt only for generic salt searches', () => {
    const refinedSalt = {
      id: 219056,
      name: '(식약처_가공) 정제염',
    };
    const seasonedSalt = {
      id: 100023,
      name: '(식약처_가공) 맛소금(정제염)',
    };

    expect(
      service.isPreferredRefinedSaltSearchResult(refinedSalt, '소금'),
    ).toBe(true);
    expect(
      service.isPreferredRefinedSaltSearchResult(seasonedSalt, '소금'),
    ).toBe(false);
    expect(
      service.isPreferredRefinedSaltSearchResult(refinedSalt, '맛소금'),
    ).toBe(false);
    expect(
      service.getPreferredRefinedSaltNameCandidates('소금 양념장'),
    ).toContain('(식약처_가공) 정제염');
  });

  it('normalizes workout names for exact search matching', () => {
    expect(service.normalizeWorkoutExactSearchName('  Bench Press ')).toBe(
      'benchpress',
    );
    expect(service.normalizeWorkoutExactSearchName('벤치 프레스')).toBe(
      '벤치프레스',
    );
  });

  it('ignores spaces for partial workout name searches', async () => {
    const andWhere = jest.fn().mockReturnThis();
    const query = {
      where: jest.fn().mockReturnThis(),
      andWhere,
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      clone: jest.fn().mockReturnThis(),
    };
    service.workoutRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };

    await service.searchWorkout({
      input: '핵스쿼트',
      limit: 20,
      cursor: null,
    });

    expect(andWhere).toHaveBeenCalledWith(
      "LOWER(REPLACE(workout.name, ' ', '')) LIKE :input",
      { input: '%핵스쿼트%' },
    );
  });

  it('resolves inner and outer thigh workout search aliases', () => {
    expect(service.resolveWorkoutSearchNameAlias('아웃타이')).toBe(
      '레버 시티드 힙 애덕션',
    );
    expect(service.resolveWorkoutSearchNameAlias('아웃 타이')).toBe(
      '레버 시티드 힙 애덕션',
    );
    expect(service.resolveWorkoutSearchNameAlias('이너타이')).toBe(
      '레버 시티드 힙 어덕션',
    );
    expect(service.resolveWorkoutSearchNameAlias('이너 타이')).toBe(
      '레버 시티드 힙 어덕션',
    );
  });

  it('keeps running search text and adds 러닝 as the preferred exact result', () => {
    ['러닝', '러닝머신', '런닝', '런닝머신', '트레드밀'].forEach(
      (searchName) => {
        expect(service.getWorkoutSearchPlan(searchName)).toEqual({
          containsInput: searchName,
          preferredExact: '러닝',
        });
      },
    );
    expect(service.getWorkoutSearchPlan('트레드 밀')).toEqual({
      containsInput: '트레드 밀',
      preferredExact: '러닝',
    });
    expect(service.resolveWorkoutSearchNameAlias('트레드밀')).toBe('트레드밀');
  });

  it('replaces a processed fried-egg image match with the generic food menu', () => {
    const candidates = new Map([
      [
        1,
        {
          id: 1,
          name: '(식약처_음식) 달걀후라이',
          brand: null,
          category: null,
          weight: 50,
          unit: 0,
        },
      ],
      [
        3,
        {
          id: 3,
          name: '(식약처_가공) 계란후라이(패티용)',
          brand: null,
          category: null,
          weight: 100,
          unit: 0,
        },
      ],
    ]);

    expect(
      service.toHomeFoodImageRecognitionResult(
        service.normalizeHomeFoodImageRematches(
          [{ food_index: 0, menu_id: 3 }],
          [
            {
              foodName: '계란 후라이',
              brand: null,
              estimatedQuantity: 55,
            },
          ],
          candidates,
          new Map([[0, new Set([1, 3])]]),
        ),
      ),
    ).toEqual({ menu_ids: [1], menu_quantities: [55] });
  });

  it('keeps an explicitly recognized processed fried egg', () => {
    const candidates = new Map([
      [
        2,
        {
          id: 2,
          name: '(식약처_가공) 냉동 계란 후라이',
          brand: null,
          category: null,
          weight: 100,
          unit: 0,
        },
      ],
    ]);

    expect(
      service.toHomeFoodImageRecognitionResult(
        service.normalizeHomeFoodImageRematches(
          [{ food_index: 0, menu_id: 2 }],
          [
            {
              foodName: '냉동 계란 후라이',
              brand: null,
              estimatedQuantity: 80,
            },
          ],
          candidates,
          new Map([[0, new Set([2])]]),
        ),
      ),
    ).toEqual({ menu_ids: [2], menu_quantities: [80] });
  });

  it('replaces a product rice image match with the generic plain rice menu', () => {
    const candidates = new Map([
      [
        10,
        {
          id: 10,
          name: '(식약처_음식) 밥',
          brand: null,
          category: null,
          weight: 200,
          unit: 0,
        },
      ],
      [
        11,
        {
          id: 11,
          name: '따끈한 흰쌀밥 득템',
          brand: '득템',
          category: null,
          weight: 210,
          unit: 0,
        },
      ],
    ]);

    expect(
      service.toHomeFoodImageRecognitionResult(
        service.normalizeHomeFoodImageRematches(
          [{ food_index: 0, menu_id: 11 }],
          [
            {
              foodName: '흰밥',
              brand: null,
              estimatedQuantity: 180,
            },
          ],
          candidates,
          new Map([[0, new Set([10, 11])]]),
        ),
      ),
    ).toEqual({ menu_ids: [10], menu_quantities: [180] });
  });

  it('fills a food omitted from a partial home image rematch', () => {
    const predictions = [
      { foodName: '수육', brand: null, estimatedQuantity: 150 },
      { foodName: '밥', brand: null, estimatedQuantity: 180 },
    ];
    const pork = {
      id: 1,
      name: '수육',
      brand: null,
      category: '고기',
      weight: 200,
      unit: 0,
    };
    const rice = {
      id: 2,
      name: '(식약처_음식) 밥',
      brand: null,
      category: '밥',
      weight: 200,
      unit: 0,
    };

    const matches = service.mergeHomeFoodImageMatchesWithLocalFallback(
      predictions,
      [
        { foodIndex: 0, foodName: '수육', candidates: [pork] },
        { foodIndex: 1, foodName: '밥', candidates: [rice] },
      ],
      [{ foodIndex: 0, menu: pork, estimatedQuantity: 150 }],
    );

    expect(service.toHomeFoodImageRecognitionResult(matches)).toEqual({
      menu_ids: [1, 2],
      menu_quantities: [150, 180],
    });
  });

  it('normalizes Gemini home image quantity as an actual gram estimate', () => {
    expect(
      service.normalizeHomeFoodImagePrediction({
        food_name: '밥',
        brand: null,
        confidence: 0.91,
        estimated_quantity: 183.26,
        quantity_unit: 'g',
        quantity_confidence: 0.74,
      }),
    ).toEqual({
      foodName: '밥',
      brand: null,
      confidence: 0.91,
      estimatedQuantity: 183.3,
      estimatedQuantityUnit: 'g',
      quantityConfidence: 0.74,
    });
  });

  it('calculates recorded calories from weight regardless of input tab', () => {
    const menu = { weight: 100, calories: 80 };

    expect(service.calculateMenuCaloriesForQuantity(menu, 150, 0)).toBe(120);
    expect(service.calculateMenuCaloriesForQuantity(menu, 150, 1)).toBe(120);
    expect(service.calculateMenuCaloriesForQuantity(menu, 150, 0)).toBe(
      service.calculateMenuCaloriesForQuantity(menu, 150, 1),
    );
  });

  it('does not calculate nutrition with an invalid reference weight', () => {
    expect(
      service.calculateMenuCaloriesForQuantity(
        { weight: 0, calories: 80 },
        150,
        0,
      ),
    ).toBe(0);
  });

  it('returns an empty result instead of unrelated alternative menus', async () => {
    const createEmptyQueryBuilder = () => {
      const builder: Record<string, jest.Mock> = {};
      ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'take'].forEach(
        (method) => {
          builder[method] = jest.fn(() => builder);
        },
      );
      builder.getMany = jest.fn().mockResolvedValue([]);
      return builder;
    };
    const searchService = Object.create(HomeService.prototype) as any;
    const exactQuery = createEmptyQueryBuilder();
    const partialQuery = createEmptyQueryBuilder();
    searchService.menuRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(exactQuery)
        .mockReturnValueOnce(partialQuery),
    };
    const alternativeSearch = jest.spyOn(
      searchService,
      'findAlternativeMenusByIntent',
    );

    const result = await searchService.search(
      { input: 'DB에 없는 특수 음료', limit: 20 },
      { id: 7 },
    );

    expect(result).toEqual({
      has_result: false,
      menu_list: [],
      next_cursor: null,
    });
    expect(alternativeSearch).not.toHaveBeenCalled();
  });

  it('does not advance the cursor past brand matches omitted from the page', async () => {
    const createQueryBuilder = (menus: Record<string, unknown>[]) => {
      const builder: Record<string, jest.Mock> = {};
      ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'take'].forEach(
        (method) => {
          builder[method] = jest.fn(() => builder);
        },
      );
      builder.getMany = jest.fn().mockResolvedValue(menus);
      return builder;
    };
    const createMenu = (id: number, name: string) => ({
      id,
      data_source: 0,
      is_deleted: 0,
      name: `(식약처_음식) ${name}`,
      search_name: name.replace(/\s+/g, ''),
      canonical_name: name.replace(/\s+/g, ''),
      brand: '피자스쿨',
      category: '피자',
      unit: 0,
      weight: 100,
      unit_quantity: '1기준량',
      calories: 250,
      carbs: 30,
      protein: 10,
      fat: 8,
    });
    const rawMenus = [
      createMenu(1, '고구마 피자'),
      createMenu(2, '고구마피자'),
      ...Array.from({ length: 11 }, (_, index) =>
        createMenu(index + 3, `피자 메뉴 ${index + 1}`),
      ),
    ];
    const searchService = Object.create(HomeService.prototype) as any;
    searchService.menuRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(createQueryBuilder([]))
        .mockReturnValueOnce(createQueryBuilder(rawMenus)),
    };

    const result = await searchService.search(
      { input: '피자스쿨', limit: 3 },
      { id: 7 },
    );

    expect(result.menu_list.map((menu) => menu.id)).toEqual([1, 3, 4]);
    expect(result.next_cursor).toBe(4);
  });

  it('returns the default cup size and zero when no water data exists', async () => {
    const waterService = Object.create(HomeService.prototype) as any;
    waterService.waterSettingRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    waterService.waterIntakeRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    await expect(
      waterService.getWaterIntake({ id: 51 }, { date: '2026-09-17' }),
    ).resolves.toEqual({
      cup_size: 100,
      water_intake: 0,
    });
  });

  it('removes an existing water record when total intake is set to zero', async () => {
    const waterService = Object.create(HomeService.prototype) as any;
    const existing = { id: 10, date: '2026-09-17', amountMl: 500 };
    const remove = jest.fn().mockResolvedValue(existing);
    const save = jest.fn();
    waterService.waterIntakeRepository = {
      findOne: jest.fn().mockResolvedValue(existing),
      remove,
      save,
    };

    await waterService.upsertWaterIntake(
      { id: 51 },
      { date: '2026-09-17', water_intake: 0 },
    );

    expect(remove).toHaveBeenCalledWith(existing);
    expect(save).not.toHaveBeenCalled();
  });

  it('builds an exact leap-year range for monthly calendar queries', () => {
    const calendarService = Object.create(HomeService.prototype) as any;

    expect(calendarService.getMonthDateRange('2024-02')).toMatchObject({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    });
    expect(calendarService.normalizeMonthlyCalendarMode('물 섭취')).toBe(
      'water',
    );
    expect(() => calendarService.getMonthDateRange('2026-13')).toThrow(
      'Invalid month',
    );
  });

  it('sums workout calories by date for the monthly calendar', async () => {
    const calendarService = Object.create(HomeService.prototype) as any;
    calendarService.workoutRecordRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 1, date: '2026-09-01', burned_calories: 120.25 },
        { id: 2, date: '2026-09-01', burned_calories: 79.75 },
        { id: 3, date: '2026-09-03', burned_calories: 50.04 },
      ]),
    };

    await expect(
      calendarService.getMonthlyCalendar(
        { id: 51 },
        { date: '2026-09', mode: '운동' },
      ),
    ).resolves.toEqual([
      { date: '2026-09-01', burned_calories: 200 },
      { date: '2026-09-03', burned_calories: 50 },
    ]);
  });

  it('returns the brand with recently eaten menus', async () => {
    const recentMenuService = Object.create(HomeService.prototype) as any;
    const queryBuilder: Record<string, jest.Mock> = {};
    [
      'innerJoin',
      'select',
      'addSelect',
      'where',
      'andWhere',
      'groupBy',
      'addGroupBy',
      'orderBy',
      'addOrderBy',
      'limit',
    ].forEach((method) => {
      queryBuilder[method] = jest.fn(() => queryBuilder);
    });
    queryBuilder.getRawMany = jest.fn().mockResolvedValue([
      {
        menu_id: '123',
        menu_name: '(식약처_가공) 닭가슴살',
        menu_brand: '비비고',
      },
      {
        menu_id: 124,
        menu_name: '(식약처_음식) 사과',
        menu_brand: null,
      },
    ]);
    recentMenuService.mealMenuRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    await expect(recentMenuService.getRecentMenus({ id: 50 })).resolves.toEqual(
      [
        { menu_id: 123, menu_name: '닭가슴살', brand: '비비고' },
        { menu_id: 124, menu_name: '사과', brand: null },
      ],
    );
    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      'menu.brand',
      'menu_brand',
    );
  });

  it('excludes deleted menus from folder list summaries', async () => {
    const folderService = Object.create(HomeService.prototype) as any;
    const queryBuilder: Record<string, jest.Mock> = {};
    ['innerJoin', 'where', 'orderBy', 'limit'].forEach((method) => {
      queryBuilder[method] = jest.fn(() => queryBuilder);
    });
    queryBuilder.getMany = jest
      .fn()
      .mockResolvedValue([{ id: 10, name: '아침 메뉴' }]);
    folderService.folderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    folderService.folderMenuRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    await expect(
      folderService.getFolders({ id: 50 }, { limit: 20 }),
    ).resolves.toEqual({
      folder_list: [
        { folder_id: 10, folder_name: '아침 메뉴', menu_names: [] },
      ],
      next_cursor: null,
    });
    expect(folderService.folderMenuRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          folder: { id: expect.anything() },
          menu: { is_deleted: 0 },
        },
      }),
    );
  });

  it('excludes deleted menus from folder detail', async () => {
    const folderService = Object.create(HomeService.prototype) as any;
    const queryBuilder: Record<string, jest.Mock> = {};
    ['innerJoin', 'where', 'andWhere'].forEach((method) => {
      queryBuilder[method] = jest.fn(() => queryBuilder);
    });
    queryBuilder.getOne = jest
      .fn()
      .mockResolvedValue({ id: 10, name: '아침 메뉴' });
    folderService.folderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    folderService.folderMenuRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    await expect(
      folderService.getFolderDetail({ id: 50 }, { folder_id: 10 }),
    ).resolves.toEqual({
      folder_name: '아침 메뉴',
      menu_list: [],
      menu_quantities: [],
      menu_input_modes: [],
    });
    expect(folderService.folderMenuRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          folder: { id: 10 },
          menu: { is_deleted: 0 },
        },
      }),
    );
  });

  it('returns every registered menu when limit is omitted', async () => {
    const registeredMenuService = Object.create(HomeService.prototype) as any;
    const queryBuilder: Record<string, jest.Mock> = {};
    ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'take'].forEach(
      (method) => {
        queryBuilder[method] = jest.fn(() => queryBuilder);
      },
    );
    queryBuilder.getMany = jest.fn().mockResolvedValue([
      {
        id: 3,
        data_source: 1,
        name: '직접 메뉴 3',
        brand: null,
        category: '기타',
        unit: 0,
        weight: 100,
        unit_quantity: '1인분',
        calories: 100,
        carbs: 10,
        protein: 5,
        fat: 2,
      },
      {
        id: 2,
        data_source: 1,
        name: '직접 메뉴 2',
        brand: null,
        category: '기타',
        unit: 0,
        weight: 100,
        unit_quantity: '1인분',
        calories: 90,
        carbs: 9,
        protein: 4,
        fat: 2,
      },
    ]);
    registeredMenuService.menuRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const response = await registeredMenuService.getRegisteredMenus(
      { id: 50 },
      {},
    );

    expect(response.menu_list.map((menu) => menu.id)).toEqual([3, 2]);
    expect(response.next_cursor).toBeNull();
    expect(queryBuilder.take).not.toHaveBeenCalled();
  });

  it('paginates and searches registered menus with an id cursor', async () => {
    const registeredMenuService = Object.create(HomeService.prototype) as any;
    const queryBuilder: Record<string, jest.Mock> = {};
    ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'take'].forEach(
      (method) => {
        queryBuilder[method] = jest.fn(() => queryBuilder);
      },
    );
    const createMenu = (id: number) => ({
      id,
      data_source: 1,
      name: `닭가슴살 ${id}`,
      brand: null,
      category: '육류',
      unit: 0,
      weight: 100,
      unit_quantity: '1인분',
      calories: 120,
      carbs: 2,
      protein: 25,
      fat: 2,
    });
    queryBuilder.getMany = jest
      .fn()
      .mockResolvedValue([createMenu(9), createMenu(8), createMenu(7)]);
    registeredMenuService.menuRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const response = await registeredMenuService.getRegisteredMenus(
      { id: 50 },
      { limit: 2, cursor: 10, input: ' 닭가슴살 ' },
    );

    expect(response.menu_list.map((menu) => menu.id)).toEqual([9, 8]);
    expect(response.next_cursor).toBe(8);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'menu.name LIKE :input',
      { input: '%닭가슴살%' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('menu.id < :cursor', {
      cursor: 10,
    });
    expect(queryBuilder.take).toHaveBeenCalledWith(3);
  });

  it('returns 30-day burned calories and deficit using steps and workouts', async () => {
    const analysisService = Object.create(HomeService.prototype) as any;
    analysisService.userInfoRepository = {
      findOne: jest.fn().mockResolvedValue({
        gender: 0,
        birthYear: 1996,
        height: 170,
        weight: 60,
      }),
    };
    analysisService.mealRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          date: new Date(2026, 8, 29, 12),
          mealMenus: [{ menu: { calories: 1500 }, quantity: 1 }],
        },
      ]),
    };
    analysisService.weightStepsRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          date: new Date(2026, 8, 29, 8),
          weight: 60,
          steps: 10000,
        },
      ]),
    };
    analysisService.workoutRecordRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 1, date: '2026-09-29', burned_calories: 200 },
        ]),
    };
    jest
      .spyOn(analysisService, 'calculateMenuCaloriesForQuantity')
      .mockReturnValue(1500);

    await expect(
      analysisService.getRecentAnalysis(
        { id: 50 },
        { date: '2026-09-29', mode: 'burned' },
      ),
    ).resolves.toEqual([
      {
        date: '2026-09-29',
        total_burned_calories: 500,
        steps_burned_calories: 300,
        workout_burned_calories: 200,
      },
    ]);

    await expect(
      analysisService.getRecentAnalysis(
        { id: 50 },
        { date: '2026-09-29', mode: 'deficit' },
      ),
    ).resolves.toEqual([
      {
        date: '2026-09-29',
        calorie_deficit: -522.5,
      },
    ]);
  });

  it('uses an inclusive 30-day range and rejects impossible dates', () => {
    const analysisService = Object.create(HomeService.prototype) as any;

    expect(analysisService.getRecentAnalysisDateRange('2026-09-29')).toEqual(
      expect.objectContaining({
        startDate: '2026-08-31',
        endDate: '2026-09-29',
      }),
    );
    expect(() =>
      analysisService.getRecentAnalysisDateRange('2026-02-30'),
    ).toThrow('Invalid date');
  });
});
