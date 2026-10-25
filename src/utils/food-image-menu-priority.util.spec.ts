import { FoodImageMenuMatcher } from '../food-image/food-image-menu-matcher';
import {
  preferUserFoodImageMenu,
  prioritizeUserFoodImageMenus,
} from './food-image-menu-priority.util';

const publicMenu = {
  id: 1,
  name: '(식약처_음식) 밥',
  brand: null,
  category: '밥류',
  weight: 200,
  unit: 0,
};
const frequentMenu = { ...publicMenu, id: 2, frequentRank: 1 };
const personalMenu = { ...publicMenu, id: 3, name: '밥', ownerUserId: 7 };
const prediction = {
  foodName: '밥',
  brand: null,
  confidence: 0.9,
  estimatedQuantity: 150,
  estimatedQuantityUnit: 'g',
  quantityConfidence: 0.8,
};

describe('food image menu source priority', () => {
  it('chooses personal, then most frequently recorded, then the selected public menu', () => {
    expect(
      preferUserFoodImageMenu(publicMenu, [
        publicMenu,
        frequentMenu,
        personalMenu,
      ]).id,
    ).toBe(3);
    expect(
      preferUserFoodImageMenu(publicMenu, [publicMenu, frequentMenu]).id,
    ).toBe(2);
    expect(preferUserFoodImageMenu(publicMenu, [publicMenu]).id).toBe(1);
    expect(
      preferUserFoodImageMenu(publicMenu, [
        { ...frequentMenu, id: 4, frequentRank: 2 },
        frequentMenu,
      ]).id,
    ).toBe(2);
  });

  it('keeps different brands and dish forms separate', () => {
    for (const other of [
      { ...personalMenu, brand: '다른브랜드' },
      { ...personalMenu, name: '김치볶음밥' },
      { ...personalMenu, name: '밥죽' },
    ]) {
      expect(preferUserFoodImageMenu(publicMenu, [publicMenu, other]).id).toBe(
        1,
      );
    }
  });

  it('replaces duplicate public foods before the candidate limit is applied', () => {
    expect(
      prioritizeUserFoodImageMenus([
        publicMenu,
        frequentMenu,
        personalMenu,
      ]).map((m) => m.id),
    ).toEqual([3]);
  });

  // 자주 먹은 메뉴가 없는 MealMenu repository와 공용 메뉴 id만 돌려주는 벡터 검색으로 matcher를 만든다.
  const createMatcher = () => {
    const builder: any = {};
    [
      'innerJoin',
      'where',
      'andWhere',
      'select',
      'addSelect',
      'groupBy',
      'orderBy',
      'addOrderBy',
      'limit',
    ].forEach((method) => {
      builder[method] = () => builder;
    });
    builder.getRawMany = async () => [];
    return new FoodImageMenuMatcher(
      { getMenusByIds: jest.fn().mockResolvedValue([publicMenu]) } as any,
      { createQueryBuilder: () => builder } as any,
      {
        searchMenusByText: jest.fn().mockResolvedValue([{ menuId: 1 }]),
      } as any,
    ) as any;
  };

  it('preserves personal and frequent IDs in rematches and local fallback', () => {
    const matcher = createMatcher();
    for (const [candidates, expected] of [
      [[publicMenu, frequentMenu, personalMenu], 3],
      [[publicMenu, frequentMenu], 2],
    ] as const) {
      const result = matcher.normalizeRematchedMenu(
        { food_index: 0, menu_id: 1 },
        [prediction],
        new Map(candidates.map((m) => [m.id, m] as const)),
        new Map([[0, new Set(candidates.map((m) => m.id))]]),
      );
      expect(result.id).toBe(expected);
      expect(result.estimatedQuantity).toBe(150);
      const local = matcher.mergeRematchesWithLocalFallback(
        [prediction],
        [{ foodIndex: 0, foodName: '밥', candidates }],
        [],
        [],
      );
      expect(local[0].id).toBe(expected);
    }
  });

  it('adds an unrecorded personal menu even when the vector search only finds a public duplicate', async () => {
    const savedVectorSearchEnabled = process.env.VECTOR_SEARCH_ENABLED;
    process.env.VECTOR_SEARCH_ENABLED = 'true';
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const groups = await createMatcher().buildCandidateGroups({
        userId: 7,
        predictions: [prediction],
        menus: [publicMenu, personalMenu],
        logPrefix: '[TEST]',
      });
      expect(groups[0].candidates.map((m) => m.id)).toEqual([3]);
    } finally {
      jest.restoreAllMocks();
      if (savedVectorSearchEnabled === undefined) {
        delete process.env.VECTOR_SEARCH_ENABLED;
      } else {
        process.env.VECTOR_SEARCH_ENABLED = savedVectorSearchEnabled;
      }
    }
  });
});
