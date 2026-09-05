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
});
