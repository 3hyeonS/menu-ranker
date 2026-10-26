import { Brackets } from 'typeorm';
import { FoodImageMenuMatcher } from '../food-image/food-image-menu-matcher';
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
  estimatedQuantity: null,
  quantityConfidence: null,
};
const toMenu = (id: number, name: string) => ({
  id,
  name,
  brand: null,
  category: null,
  weight: null,
  unit: 0,
});
const frequent = toMenu(20, '닭가슴살');
const vector = toMenu(30, '닭가슴살 구이');
const unrelated = toMenu(40, '초콜릿');

const createMatcher = (
  repository: ReturnType<typeof createRepository>,
  vectorCandidates: Array<ReturnType<typeof toMenu>>,
) => {
  const matcher = new FoodImageMenuMatcher(
    {} as never,
    repository as never,
  ) as any;
  matcher.getVectorCandidateGroups = jest.fn().mockResolvedValue([
    {
      foodIndex: 0,
      foodName: prediction.foodName,
      candidates: vectorCandidates,
    },
  ]);
  return matcher;
};

describe('frequent menus in food image candidates', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('includes matching frequent menus alongside vector candidates without duplicates or unrelated foods', async () => {
    const repository = createRepository();
    repository.query.getRawMany.mockResolvedValue([
      { menu_id: 20 },
      { menu_id: 40 },
    ]);
    const matcher = createMatcher(repository, [vector, frequent]);

    const groups = await matcher.buildCandidateGroups({
      userId: 7,
      predictions: [prediction],
      menus: [frequent, vector, unrelated],
      logPrefix: '[TEST]',
    });

    expect(groups[0].candidates.map((menu) => menu.id)).toEqual([20, 30]);
  });

  it('keeps an unrecorded personal food when frequent public duplicates fill the candidate limit', async () => {
    const duplicates = Array.from({ length: 9 }, (_, index) => ({
      ...frequent,
      id: index + 1,
    }));
    const personal = { ...frequent, id: 100, ownerUserId: 7 };
    const repository = createRepository();
    repository.query.getRawMany.mockResolvedValue(
      duplicates.map((menu) => ({ menu_id: menu.id })),
    );
    const matcher = createMatcher(repository, duplicates.slice(0, 8));

    const groups = await matcher.buildCandidateGroups({
      userId: 7,
      predictions: [prediction],
      menus: [...duplicates, personal],
      logPrefix: '[TEST]',
    });

    expect(groups[0].candidates.map((menu) => menu.id)).toEqual([100]);
  });
});
