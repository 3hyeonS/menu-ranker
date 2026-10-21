import { Brackets } from 'typeorm';
import { HomeService } from '../home/home.service';
import { ChatService } from '../chat/chat.service';
import { getFrequentlyRecordedMenuIds } from './frequent-menu.util';

function createRepository() {
  const query: any = {};
  for (const method of [
    'innerJoin',
    'where',
    'andWhere',
    'select',
    'addSelect',
    'groupBy',
    'orderBy',
    'addOrderBy',
    'limit',
  ]) {
    query[method] = jest.fn().mockReturnValue(query);
  }
  query.getRawMany = jest.fn().mockResolvedValue([{ menu_id: '20' }]);
  return { createQueryBuilder: jest.fn().mockReturnValue(query), query };
}

const prediction = {
  foodName: '닭가슴살',
  brand: null,
  confidence: 0.9,
};
const frequent = { id: 20, name: '닭가슴살', brand: null, category: null };
const vector = { id: 30, name: '닭가슴살 구이', brand: null, category: null };
const unrelated = { id: 40, name: '초콜릿', brand: null, category: null };

describe('frequent menus in food image candidates', () => {
  it('selects the current user top 20 and excludes deleted and other-user menus', async () => {
    const repository = createRepository();
    expect(await getFrequentlyRecordedMenuIds(repository as never, 7)).toEqual([
      20,
    ]);
    expect(repository.query.where).toHaveBeenCalledWith(
      'meal.userId = :userId',
      { userId: 7 },
    );
    expect(repository.query.andWhere).toHaveBeenCalledWith(
      'menu.is_deleted = :isDeleted',
      { isDeleted: 0 },
    );
    const ownership = repository.query.andWhere.mock.calls.find(
      ([arg]) => arg instanceof Brackets,
    )[0];
    const qb = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
    };
    ownership.whereFactory(qb);
    expect(qb.where).toHaveBeenCalledWith('menu.userId IS NULL');
    expect(qb.orWhere).toHaveBeenCalledWith('menu.userId = :userId', {
      userId: 7,
    });
    expect(repository.query.orderBy).toHaveBeenCalledWith(
      'record_count',
      'DESC',
    );
    expect(repository.query.limit).toHaveBeenCalledWith(20);
  });

  it('includes matching frequent menus even when home vector candidates exist', async () => {
    const service = Object.create(HomeService.prototype) as any;
    service.isVectorSearchEnabled = () => true;
    service.menuVectorService = {
      searchMenusByText: jest.fn().mockResolvedValue([{ menuId: 30 }]),
    };
    service.getFoodImageRecognitionMenusByIds = jest
      .fn()
      .mockResolvedValue([vector]);
    const result = await service.getFoodImageCandidatesForSingleFood(
      7,
      prediction,
      [frequent, vector, unrelated],
      [frequent, unrelated],
    );
    expect(result.candidates.map((menu) => menu.id)).toEqual([20, 30]);
  });

  it('includes frequent menus alongside chat vector candidates without duplicates or unrelated foods', async () => {
    const service = Object.create(ChatService.prototype) as any;
    const repository = createRepository();
    repository.query.getRawMany.mockResolvedValue([
      { menu_id: 20 },
      { menu_id: 40 },
    ]);
    service.mealMenuRepository = repository;
    service.getFoodImageVectorCandidateGroupsByPrediction = jest
      .fn()
      .mockResolvedValue([
        {
          foodIndex: 0,
          foodName: prediction.foodName,
          candidates: [vector, frequent],
        },
      ]);
    const groups = await service.buildFoodImageCandidateGroupsByPrediction(
      7,
      [prediction],
      [frequent, vector, unrelated],
      { inferredBrand: null, inferredCategory: null },
    );
    expect(groups[0].candidates.map((menu) => menu.id)).toEqual([20, 30]);
  });
  it('keeps an unrecorded personal food when frequent public duplicates fill the chat candidate limit', async () => {
    const service = Object.create(ChatService.prototype) as any;
    const duplicates = Array.from({ length: 9 }, (_, index) => ({
      ...frequent,
      id: index + 1,
    }));
    const personal = { ...frequent, id: 100, ownerUserId: 7 };
    const repository = createRepository();
    repository.query.getRawMany.mockResolvedValue(
      duplicates.map((menu) => ({ menu_id: menu.id })),
    );
    service.mealMenuRepository = repository;
    service.getFoodImageVectorCandidateGroupsByPrediction = jest
      .fn()
      .mockResolvedValue([
        {
          foodIndex: 0,
          foodName: prediction.foodName,
          candidates: duplicates.slice(0, 8),
        },
      ]);
    const groups = await service.buildFoodImageCandidateGroupsByPrediction(
      7,
      [prediction],
      [...duplicates, personal],
      { inferredBrand: null, inferredCategory: null },
    );
    expect(groups[0].candidates.map((menu) => menu.id)).toEqual([100]);
  });
});
