import { FoodImageMenuMatcher } from './food-image-menu-matcher';
import {
  FoodImageMatchPrediction,
  FoodImageMenuCandidate,
} from './food-image.types';
import { runWithRequestAbortSignal } from '../utils/request-abort.util';

const menu = (
  value: Partial<FoodImageMenuCandidate> & { id: number; name: string },
): FoodImageMenuCandidate => ({
  brand: null,
  category: null,
  weight: null,
  unit: 0,
  ...value,
});

const prediction = (
  value: Partial<FoodImageMatchPrediction> & { foodName: string },
): FoodImageMatchPrediction => ({
  productName: null,
  brand: null,
  confidence: 0.9,
  estimatedQuantity: null,
  quantityConfidence: null,
  ...value,
});

// 자주 먹은 메뉴 조회(getFrequentlyRecordedMenuIds)가 빈 목록을 돌려주는 MealMenu repository mock
const createMealMenuRepository = (frequentMenuIds: number[] = []) => {
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
  builder.getRawMany = async () =>
    frequentMenuIds.map((menuId) => ({ menu_id: menuId }));
  return { createQueryBuilder: () => builder };
};

const createMatcher = ({
  menusById = [] as FoodImageMenuCandidate[],
  vectorMenuIds = null as number[] | null,
  frequentMenuIds = [] as number[],
} = {}) => {
  const catalog = {
    getMenusByIds: jest.fn(async (_userId: number, ids: number[]) =>
      ids
        .map((id) => menusById.find((candidate) => candidate.id === id))
        .filter(Boolean),
    ),
  };
  const menuVectorService =
    vectorMenuIds === null
      ? undefined
      : {
          searchMenusByText: jest
            .fn()
            .mockResolvedValue(vectorMenuIds.map((menuId) => ({ menuId }))),
        };
  const matcher = new FoodImageMenuMatcher(
    catalog as any,
    createMealMenuRepository(frequentMenuIds) as any,
    menuVectorService as any,
  ) as any;

  return { matcher, catalog, menuVectorService };
};

describe('FoodImageMenuMatcher', () => {
  const savedVectorSearchEnabled = process.env.VECTOR_SEARCH_ENABLED;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (savedVectorSearchEnabled === undefined) {
      delete process.env.VECTOR_SEARCH_ENABLED;
    } else {
      process.env.VECTOR_SEARCH_ENABLED = savedVectorSearchEnabled;
    }
  });

  describe('rematch normalization', () => {
    const normalize = (
      value: Record<string, unknown>,
      predictions: FoodImageMatchPrediction[],
      candidates: FoodImageMenuCandidate[],
      idsByFoodIndex: Map<number, Set<number>>,
    ) =>
      createMatcher().matcher.normalizeRematchedMenu(
        value,
        predictions,
        new Map(candidates.map((candidate) => [candidate.id, candidate])),
        idsByFoodIndex,
      );

    it('replaces a processed fried-egg match with the generic food menu', () => {
      const result = normalize(
        { food_index: 0, menu_id: 3, confidence: 0.9 },
        [
          prediction({
            foodName: '계란 후라이',
            estimatedQuantity: 120,
            quantityConfidence: 0.6,
          }),
        ],
        [
          menu({ id: 1, name: '(식약처_음식) 달걀후라이', weight: 50 }),
          menu({ id: 3, name: '(식약처_가공) 계란후라이(패티용)' }),
        ],
        new Map([[0, new Set([1, 3])]]),
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 1,
          name: '(식약처_음식) 달걀후라이',
          foodIndex: 0,
          confidence: 0.9,
          estimatedQuantity: 120,
          estimatedQuantityUnit: 'g',
          quantityConfidence: 0.6,
        }),
      );
    });

    it('keeps an explicitly recognized processed fried egg', () => {
      const result = normalize(
        { food_index: 0, menu_id: 2 },
        [prediction({ foodName: '냉동 계란 후라이', estimatedQuantity: 80 })],
        [menu({ id: 2, name: '(식약처_가공) 냉동 계란 후라이' })],
        new Map([[0, new Set([2])]]),
      );

      expect(result.id).toBe(2);
      expect(result.confidence).toBe(0.9);
    });

    it('replaces a product rice match with the generic plain rice menu', () => {
      const result = normalize(
        { food_index: 0, menu_id: 11, confidence: 0.9 },
        [prediction({ foodName: '흰밥' })],
        [
          menu({ id: 10, name: '(식약처_음식) 밥' }),
          menu({ id: 11, name: '따끈한 흰쌀밥 득템', brand: '득템' }),
        ],
        new Map([[0, new Set([10, 11])]]),
      );

      expect(result.id).toBe(10);
    });

    it('rejects a menu id outside that food candidates', () => {
      const result = normalize(
        { food_index: 0, menu_id: 2 },
        [prediction({ foodName: '밥' }), prediction({ foodName: '김치' })],
        [menu({ id: 1, name: '밥' }), menu({ id: 2, name: '김치' })],
        new Map([
          [0, new Set([1])],
          [1, new Set([2])],
        ]),
      );

      expect(result).toBeNull();
    });
  });

  describe('candidate selection', () => {
    it('prioritizes menus matching a brand read from a food image', () => {
      const result = createMatcher().matcher.findBrandCandidates(
        prediction({ foodName: '즉석밥', brand: '햇반' }),
        [
          menu({ id: 1, name: '일반 즉석밥', brand: '다른브랜드' }),
          menu({ id: 2, name: '햇반 백미밥', brand: 'CJ제일제당' }),
          menu({ id: 3, name: '잡곡밥', brand: '햇반' }),
        ],
        8,
      );

      expect(result.map((candidate: { id: number }) => candidate.id)).toEqual([
        3, 2,
      ]);
    });

    it('uses the exact branded product name recognized for that food', () => {
      const product = menu({
        id: 198298,
        name: '(식약처_가공) 요거톡 스타볼',
        brand: '풀무원다논',
      });

      expect(
        createMatcher().matcher.findExactProductCandidates(
          prediction({
            foodName: '요거트',
            productName: '요거톡 스타볼',
            brand: '풀무원 다논',
          }),
          [
            menu({
              id: 47391,
              name: '(식약처_가공) 그릭시그니처요거트',
              brand: '풀무원다논',
            }),
            product,
          ],
          8,
        ),
      ).toEqual([product]);
    });

    it('uses an exact product name when the brand is abbreviated', () => {
      const amazingOat = menu({
        id: 200001,
        name: '(식약처_가공) 어메이징 오트 언스위트',
        brand: '매일유업',
        unit: 1,
      });

      expect(
        createMatcher().matcher.findExactProductCandidates(
          prediction({
            foodName: '오트 음료',
            productName: '어메이징 오트 언스위트',
            brand: '매일',
          }),
          [
            menu({ id: 102432, name: '(식약처_가공) 매일견과음료' }),
            amazingOat,
          ],
          8,
        ),
      ).toEqual([amazingOat]);
    });

    it('does not treat a beverage named 프라이 as BHC fried chicken', () => {
      const { matcher } = createMatcher();
      const beverage = menu({
        id: 270166,
        name: '(식약처_가공) 프라이',
        brand: 'BRAUEREI SCHLOSS EGGENBERG STOHR GMBH & CO KG',
        category: '음료류',
        unit: 1,
      });

      expect(
        matcher.findExactProductCandidates(
          prediction({ foodName: '후라이드 치킨', brand: 'bhc' }),
          [beverage],
          10,
        ),
      ).toEqual([]);
      expect(matcher.isDishTypeCompatible('후라이드 치킨', beverage)).toBe(
        false,
      );
      expect(
        matcher.isDishTypeCompatible(
          '후라이드 치킨',
          menu({
            id: 1,
            name: '(식약처_음식) 후라이드치킨',
            category: '닭튀김',
          }),
        ),
      ).toBe(true);
    });

    it('rejects sweet potato porridge for a generic sweet potato photo', () => {
      const { matcher } = createMatcher();
      const porridge = menu({
        id: 37047,
        name: '(식약처_가공) 고구마미음',
        category: '즉석조리식품',
      });

      expect(matcher.isDishTypeCompatible('고구마', porridge)).toBe(false);
      expect(matcher.isDishTypeCompatible('고구마미음', porridge)).toBe(true);
    });

    it('keeps the public plain-rice menu even when vector search returns a product rice', async () => {
      process.env.VECTOR_SEARCH_ENABLED = 'true';
      const plainRice = menu({
        id: 10,
        name: '(식약처_음식) 밥',
        category: '밥류',
      });
      const productRice = menu({
        id: 11,
        name: '덕수파스타 필라프 흰쌀밥',
        brand: '엄지식품',
        category: '즉석밥',
      });
      const { matcher } = createMatcher({
        menusById: [productRice],
        vectorMenuIds: [11],
      });

      const groups = await matcher.buildCandidateGroups({
        userId: 50,
        predictions: [prediction({ foodName: '흰쌀밥' })],
        menus: [productRice, plainRice],
        logPrefix: '[TEST]',
      });

      expect(
        groups[0].candidates.map((candidate: { id: number }) => candidate.id),
      ).toEqual([10, 11]);
    });

    it('falls back to local candidates when vector search returns only an incompatible menu', async () => {
      process.env.VECTOR_SEARCH_ENABLED = 'true';
      const beverage = menu({
        id: 270166,
        name: '(식약처_가공) 프라이',
        category: '음료류',
        unit: 1,
      });
      const chicken = menu({
        id: 100,
        name: '(식약처_음식) 후라이드치킨',
        brand: 'BHC',
        category: '닭튀김',
      });
      const { matcher } = createMatcher({
        menusById: [beverage],
        vectorMenuIds: [270166],
      });

      const groups = await matcher.buildCandidateGroups({
        userId: 107,
        predictions: [prediction({ foodName: '후라이드 치킨', brand: 'bhc' })],
        menus: [beverage, chicken],
        logPrefix: '[TEST]',
      });

      expect(groups).toHaveLength(1);
      expect(groups[0].preferredCandidateId).toBeUndefined();
      expect(
        groups[0].candidates.map((candidate: { id: number }) => candidate.id),
      ).toEqual([100]);
    });

    it('uses local candidates for every food when one vector search fails', async () => {
      process.env.VECTOR_SEARCH_ENABLED = 'true';
      const rice = menu({ id: 1, name: '(식약처_음식) 밥' });
      const kimchi = menu({ id: 2, name: '(식약처_음식) 배추김치' });
      const { matcher, menuVectorService } = createMatcher({
        menusById: [rice],
        vectorMenuIds: [1],
      });
      menuVectorService!.searchMenusByText
        .mockResolvedValueOnce([{ menuId: 1 }])
        .mockRejectedValueOnce(new Error('pgvector down'));

      const groups = await matcher.buildCandidateGroups({
        userId: 1,
        predictions: [
          prediction({ foodName: '밥' }),
          prediction({ foodName: '배추김치' }),
        ],
        menus: [rice, kimchi],
        logPrefix: '[TEST]',
      });

      expect(
        groups.map((group: { candidates: Array<{ id: number }> }) =>
          group.candidates.map((candidate) => candidate.id),
        ),
      ).toEqual([[1], [2]]);
    });

    it('prefers a personal or frequently eaten copy of the same food', async () => {
      const publicRice = menu({ id: 10, name: '(식약처_음식) 밥' });
      const personalRice = menu({
        id: 20,
        name: '(식약처_음식) 밥',
        ownerUserId: 7,
      });
      const { matcher } = createMatcher();

      const groups = await matcher.buildCandidateGroups({
        userId: 7,
        predictions: [prediction({ foodName: '밥' })],
        menus: [publicRice, personalRice],
        logPrefix: '[TEST]',
      });

      expect(groups[0].candidates[0].id).toBe(20);
    });
  });

  describe('local fallback', () => {
    it('keeps the exact per-food product when Gemini rematching returns no match', () => {
      const genericYogurt = menu({
        id: 47391,
        name: '(식약처_가공) 그릭시그니처요거트',
        brand: '풀무원다논',
      });
      const exactProduct = menu({
        id: 198298,
        name: '(식약처_가공) 요거톡 스타볼',
        brand: '풀무원다논',
      });

      const result = createMatcher().matcher.mergeRematchesWithLocalFallback(
        [
          prediction({
            foodName: '요거트',
            productName: '요거톡 스타볼',
            brand: '풀무원다논',
            estimatedQuantity: 265,
          }),
        ],
        [
          {
            foodIndex: 0,
            foodName: '요거트',
            candidates: [exactProduct, genericYogurt],
            preferredCandidateId: 198298,
          },
        ],
        [genericYogurt, exactProduct],
        [],
      );

      expect(result[0]).toEqual(
        expect.objectContaining({ id: 198298, estimatedQuantity: 265 }),
      );
    });

    it('locally fills only foods omitted from a partial Gemini rematch', () => {
      const pork = menu({ id: 1, name: '수육', category: '한식' });
      const rice = menu({ id: 2, name: '(식약처_음식) 밥', category: '밥' });
      const predictions = [
        prediction({ foodName: '수육', estimatedQuantity: 150 }),
        prediction({ foodName: '밥', estimatedQuantity: 180 }),
      ];
      const rematchedPork = {
        ...pork,
        foodIndex: 0,
        confidence: 0.95,
        estimatedQuantity: 150,
        estimatedQuantityUnit: 'g',
        quantityConfidence: null,
      };

      const result = createMatcher().matcher.mergeRematchesWithLocalFallback(
        predictions,
        [
          { foodIndex: 0, foodName: '수육', candidates: [pork] },
          { foodIndex: 1, foodName: '밥', candidates: [rice] },
        ],
        [pork, rice],
        [rematchedPork],
      );

      expect(result.map((food: { id: number }) => food.id)).toEqual([1, 2]);
      expect(result[1]).toEqual(
        expect.objectContaining({ foodIndex: 1, estimatedQuantity: 180 }),
      );
    });

    it('skips a local candidate below the minimum score', () => {
      const result = createMatcher().matcher.mergeRematchesWithLocalFallback(
        [prediction({ foodName: '마라탕' })],
        [
          {
            foodIndex: 0,
            foodName: '마라탕',
            candidates: [menu({ id: 1, name: '아이스 아메리카노' })],
          },
        ],
        [],
        [],
      );

      expect(result).toEqual([]);
    });
  });

  describe('match', () => {
    const rice = menu({ id: 1, name: '(식약처_음식) 밥', weight: 210 });
    const kimchi = menu({ id: 2, name: '(식약처_음식) 배추김치', weight: 50 });
    const predictions = [
      prediction({ foodName: '밥', estimatedQuantity: 180, confidence: 0.8 }),
      prediction({ foodName: '배추김치', estimatedQuantity: 40 }),
    ];

    it('uses Gemini rematch results and sends each food its own candidates', async () => {
      const { matcher } = createMatcher();
      const requestRematchJson = jest.fn().mockResolvedValue({
        detected_foods: [
          { food_index: 0, menu_id: 1, confidence: 0.97 },
          { food_index: 1, menu_id: 2, confidence: 0.91 },
        ],
      });

      const matches = await matcher.match({
        userId: 7,
        predictions,
        menus: [rice, kimchi],
        requestRematchJson,
        logPrefix: '[TEST]',
      });

      expect(requestRematchJson).toHaveBeenCalledTimes(1);
      expect(requestRematchJson.mock.calls[0][0]).toContain(
        '"source":"public"',
      );
      expect(
        matches.map((match: any) => [
          match.id,
          match.foodIndex,
          match.confidence,
        ]),
      ).toEqual([
        [1, 0, 0.97],
        [2, 1, 0.91],
      ]);
    });

    it('falls back to local matches when Gemini rematch fails', async () => {
      const { matcher } = createMatcher();

      const matches = await matcher.match({
        userId: 7,
        predictions,
        menus: [rice, kimchi],
        requestRematchJson: jest
          .fn()
          .mockRejectedValue(
            new Error('Food image recognition is unavailable'),
          ),
        logPrefix: '[TEST]',
      });

      expect(matches.map((match: { id: number }) => match.id)).toEqual([1, 2]);
      expect(matches[0].estimatedQuantity).toBe(180);
    });

    it('keeps one match per menu with the higher confidence', async () => {
      const { matcher } = createMatcher();

      const matches = await matcher.match({
        userId: 7,
        predictions: [
          prediction({ foodName: '밥', confidence: 0.6 }),
          prediction({ foodName: '흰밥', confidence: 0.9 }),
        ],
        menus: [rice],
        requestRematchJson: jest.fn().mockResolvedValue({ detected_foods: [] }),
        logPrefix: '[TEST]',
      });

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual(
        expect.objectContaining({ id: 1, foodIndex: 1, confidence: 0.9 }),
      );
    });

    it('rethrows request cancellation from the Gemini rematch', async () => {
      const { matcher } = createMatcher();
      const controller = new AbortController();
      const requestRematchJson = jest.fn(async () => {
        controller.abort();
        throw new Error('canceled');
      });

      await expect(
        runWithRequestAbortSignal(controller.signal, () =>
          matcher.match({
            userId: 7,
            predictions,
            menus: [rice, kimchi],
            requestRematchJson,
            logPrefix: '[TEST]',
          }),
        ),
      ).rejects.toThrow();
    });
  });
});
