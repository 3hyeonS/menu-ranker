import { HomeService } from '../home/home.service';
import { ChatService } from '../chat/chat.service';
import { FakeGeminiClient } from '../gemini/fake-gemini.client';
import { FakeFileStorage } from '../storage/fake-file-storage';
import { FoodImageMenuMatcher } from './food-image-menu-matcher';
import { FoodImageMenuCandidate } from './food-image.types';

const file = {
  buffer: Buffer.from('image'),
  mimetype: 'image/jpeg',
} as Express.Multer.File;

const rice: FoodImageMenuCandidate = {
  id: 1,
  name: '(식약처_음식) 밥',
  brand: null,
  category: '밥류',
  weight: 210,
  unit: 0,
};
const cola: FoodImageMenuCandidate = {
  id: 2,
  name: '코카콜라',
  brand: '코카콜라',
  category: '음료류',
  weight: 250,
  unit: 1,
};

// 자주 먹은 메뉴가 없는 MealMenu repository mock
const mealMenuRepository = () => {
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
  return { createQueryBuilder: () => builder } as any;
};

const createCatalog = (menus: FoodImageMenuCandidate[]) => ({
  getCandidateMenus: jest.fn().mockResolvedValue(menus),
  getMenusByIds: jest.fn(async (_userId: number, ids: number[]) =>
    menus.filter((menu) => ids.includes(menu.id)),
  ),
  invalidatePublicMenus: jest.fn(),
});

describe('food image pipeline callers', () => {
  const savedVectorSearchEnabled = process.env.VECTOR_SEARCH_ENABLED;

  beforeEach(() => {
    delete process.env.VECTOR_SEARCH_ENABLED;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (savedVectorSearchEnabled === undefined) {
      delete process.env.VECTOR_SEARCH_ENABLED;
    } else {
      process.env.VECTOR_SEARCH_ENABLED = savedVectorSearchEnabled;
    }
  });

  describe('HomeService.recognizeFoodImage', () => {
    const createHomeService = () => {
      const gemini = new FakeGeminiClient();
      const fileStorage = new FakeFileStorage();
      const catalog = createCatalog([rice, cola]);
      const service = Object.create(HomeService.prototype) as any;
      service.geminiClient = gemini;
      service.fileStorage = fileStorage;
      service.foodImageMenuCatalog = catalog;
      service.foodImageMenuMatcher = new FoodImageMenuMatcher(
        catalog as any,
        mealMenuRepository(),
      );
      return { service, gemini, fileStorage };
    };

    it('keeps the home response shape and falls back to menu weight for the quantity', async () => {
      const { service, gemini, fileStorage } = createHomeService();
      gemini
        .respondJson({
          recognition_status: 'recognized',
          detected_foods: [
            { food_name: '밥', estimated_quantity: 183.26, quantity_unit: 'g' },
            { food_name: '콜라', brand: '코카콜라' },
          ],
        })
        .respondJson({
          detected_foods: [
            { food_index: 0, menu_id: 1 },
            { food_index: 1, menu_id: 2 },
          ],
        });

      const result = await service.recognizeFoodImage({ id: 7 }, file);

      expect(result).toEqual({
        menu_ids: [1, 2],
        // 응답 DTO가 공용 메뉴 출처 접두어를 지운다(기존과 같음).
        menu_names: ['밥', '코카콜라'],
        menu_quantities: [183.3, 250],
        image_url: expect.stringContaining('meal-recognition/7/'),
      });
      expect(gemini.requests).toHaveLength(2);
      expect(gemini.requests[1]).toEqual(
        expect.objectContaining({
          modelGroup: 'image',
          unavailableMessage: 'Food image recognition is unavailable',
        }),
      );
      expect(gemini.requests[1].systemInstruction).toBeUndefined();
      expect(fileStorage.uploads).toHaveLength(1);
    });

    it('matches locally when the Gemini rematch is unavailable', async () => {
      const { service, gemini } = createHomeService();
      gemini
        .respondJson({
          recognition_status: 'recognized',
          detected_foods: [{ food_name: '밥', estimated_quantity: 150 }],
        })
        .failUnavailable();

      const result = await service.recognizeFoodImage({ id: 7 }, file);

      expect(result.menu_ids).toEqual([1]);
      expect(result.menu_quantities).toEqual([150]);
    });
  });

  describe('ChatService.recognizeFoodImageMenusWithGemini', () => {
    it('passes predictions to the shared matcher and keeps the detected positions', async () => {
      const gemini = new FakeGeminiClient();
      const catalog = createCatalog([rice, cola]);
      const service = Object.create(ChatService.prototype) as any;
      service.geminiClient = gemini;
      service.toLightweightChatContext = () => ({});
      service.foodImageMenuMatcher = new FoodImageMenuMatcher(
        catalog as any,
        mealMenuRepository(),
      );
      gemini
        .respondJson({
          intro_message: '밥이랑 콜라네.',
          image_summary: '밥과 콜라가 있어.',
          recognition_status: 'recognized',
          detected_foods: [
            {
              food_name: '밥',
              confidence: 0.9,
              estimated_quantity: 180,
              quantity_unit: 'g',
              position: { x: 0.3, y: 0.4 },
            },
            {
              food_name: '콜라',
              brand: '코카콜라',
              confidence: 0.8,
              estimated_quantity: 250,
              quantity_unit: 'ml',
              position: { x: 0.7, y: 0.5 },
            },
          ],
        })
        .respondJson({
          detected_foods: [{ food_index: 1, menu_id: 2, confidence: 0.95 }],
        });

      const result = await service.recognizeFoodImageMenusWithGemini(
        7,
        file,
        [rice, cola],
        {},
        {},
      );

      expect(result.introMessage).toBe('밥이랑 콜라네.');
      expect(
        result.foods.map((food: any) => ({
          id: food.id,
          foodIndex: food.foodIndex,
          position: food.position,
          estimatedQuantity: food.estimatedQuantity,
          estimatedQuantityUnit: food.estimatedQuantityUnit,
        })),
      ).toEqual([
        {
          id: 2,
          foodIndex: 1,
          position: { x: 0.7, y: 0.5 },
          estimatedQuantity: 250,
          estimatedQuantityUnit: 'ml',
        },
        {
          id: 1,
          foodIndex: 0,
          position: { x: 0.3, y: 0.4 },
          estimatedQuantity: 180,
          estimatedQuantityUnit: 'g',
        },
      ]);
      expect(gemini.requests[1].systemInstruction).toBeDefined();
    });
  });

  describe('ChatService generic menu matching without vector search', () => {
    it('scores the lightweight catalog and loads only the selected menus', async () => {
      const service = Object.create(ChatService.prototype) as any;
      const catalog = createCatalog([rice, cola]);
      const riceEntity = { ...rice, calories: 300 };
      service.foodImageMenuCatalog = catalog;
      service.getMenusByIds = jest
        .fn()
        .mockImplementation(async (_userId: number, ids: number[]) =>
          ids.includes(1) ? [riceEntity] : [],
        );

      const result = await service.matchGenericMenuCandidatesToFeedbackMenus(
        7,
        [{ name: '흰밥', originalName: null, brand: null, category: null }],
        {},
      );

      expect(catalog.getCandidateMenus).toHaveBeenCalledWith(7);
      expect(service.getMenusByIds).toHaveBeenCalledWith(7, [1]);
      expect(result).toEqual([{ inputMenuName: '흰밥', menu: riceEntity }]);
    });
  });
});
