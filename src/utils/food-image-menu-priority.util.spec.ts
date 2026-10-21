import { HomeService } from '../home/home.service';
import { ChatService } from '../chat/chat.service';
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

  it('does not let the home generic-food correction override a personal menu', () => {
    const service = Object.create(HomeService.prototype) as any;
    const candidates = [publicMenu, frequentMenu, personalMenu];
    const result = service.normalizeHomeFoodImageRematches(
      [{ food_index: 0, menu_id: 1 }],
      [prediction],
      new Map(candidates.map((m) => [m.id, m] as const)),
      new Map([[0, new Set([1, 2, 3])]]),
    );
    expect(result[0].menu.id).toBe(3);
    expect(result[0].estimatedQuantity).toBe(150);
    const fallback = service.mergeHomeFoodImageMatchesWithLocalFallback(
      [prediction],
      [{ foodIndex: 0, foodName: '밥', candidates }],
      [],
    );
    expect(fallback[0].menu.id).toBe(3);
  });

  it('preserves personal and frequent IDs in chat rematches and local fallback', () => {
    const service = Object.create(ChatService.prototype) as any;
    for (const [candidates, expected] of [
      [[publicMenu, frequentMenu, personalMenu], 3],
      [[publicMenu, frequentMenu], 2],
    ] as const) {
      const result = service.normalizeRematchedFoodImageMenu(
        { food_index: 0, menu_id: 1 },
        [prediction],
        new Map(candidates.map((m) => [m.id, m] as const)),
        new Map([[0, new Set(candidates.map((m) => m.id))]]),
      );
      expect(result.id).toBe(expected);
      const local = service.matchFoodImagePredictionLocally(
        prediction,
        candidates,
        0,
      );
      expect(local.id).toBe(expected);
    }
  });

  it('adds an unrecorded personal menu even when the home vector search only finds a public duplicate', async () => {
    const service = Object.create(HomeService.prototype) as any;
    service.isVectorSearchEnabled = () => true;
    service.menuVectorService = {
      searchMenusByText: jest.fn().mockResolvedValue([{ menuId: 1 }]),
    };
    service.getFoodImageRecognitionMenusByIds = jest
      .fn()
      .mockResolvedValue([publicMenu]);
    const result = await service.getFoodImageCandidatesForSingleFood(
      7,
      prediction,
      [publicMenu, personalMenu],
    );
    expect(result.candidates.map((m) => m.id)).toEqual([3]);
  });
});
