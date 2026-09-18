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

  it('normalizes workout names for exact search matching', () => {
    expect(service.normalizeWorkoutExactSearchName('  Bench Press ')).toBe(
      'benchpress',
    );
    expect(service.normalizeWorkoutExactSearchName('벤치 프레스')).toBe(
      '벤치프레스',
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
        },
      ],
    ]);

    expect(
      service.normalizeHomeFoodImageRematchResult(
        [{ food_index: 0, menu_id: 3, quantity: 1 }],
        candidates,
        new Map([[0, new Set([1, 3])]]),
        new Map([[0, '계란 후라이']]),
      ),
    ).toEqual({ menu_ids: [1], menu_quantities: [50] });
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
        },
      ],
    ]);

    expect(
      service.normalizeHomeFoodImageRematchResult(
        [{ food_index: 0, menu_id: 2, quantity: 1 }],
        candidates,
        new Map([[0, new Set([2])]]),
        new Map([[0, '냉동 계란 후라이']]),
      ),
    ).toEqual({ menu_ids: [2], menu_quantities: [100] });
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
        },
      ],
    ]);

    expect(
      service.normalizeHomeFoodImageRematchResult(
        [{ food_index: 0, menu_id: 11, quantity: 1 }],
        candidates,
        new Map([[0, new Set([10, 11])]]),
        new Map([[0, '흰밥']]),
      ),
    ).toEqual({ menu_ids: [10], menu_quantities: [200] });
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
});
