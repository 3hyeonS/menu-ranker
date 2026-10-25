import { HomeService } from '../home/home.service';
import { FoodImageMenuCatalog } from './food-image-menu-catalog';

const publicRows = [
  {
    ownerUserId: null,
    id: 1,
    name: '밥',
    brand: null,
    category: null,
    weight: '210',
    unit: 0,
  },
  {
    ownerUserId: null,
    id: 5,
    name: '김치',
    brand: null,
    category: null,
    weight: '50',
    unit: 0,
  },
  {
    ownerUserId: null,
    id: 9,
    name: '라면',
    brand: '농심',
    category: null,
    weight: null,
    unit: 0,
  },
];
const personalRows = [
  {
    ownerUserId: 7,
    id: 3,
    name: '내 샐러드',
    brand: null,
    category: null,
    weight: '180',
    unit: 0,
  },
  {
    ownerUserId: 7,
    id: 12,
    name: '내 밥',
    brand: null,
    category: null,
    weight: '200',
    unit: 0,
  },
];

// where 조건(공용/개인)에 맞는 행을 돌려주는 QueryBuilder mock
function createMenuRepository() {
  const queries: Array<{ where: string; params: any }> = [];
  const createQueryBuilder = jest.fn(() => {
    const query: { where: string; params: any } = { where: '', params: {} };
    queries.push(query);
    const builder: any = {
      leftJoin: () => builder,
      select: () => builder,
      where: (condition: string, params: any) => {
        query.where = condition;
        query.params = params;
        return builder;
      },
      andWhere: () => builder,
      orderBy: () => builder,
      getRawMany: async () =>
        query.where === 'user.id IS NULL'
          ? publicRows
          : personalRows.filter(
              (row) => row.ownerUserId === query.params.userId,
            ),
    };
    return builder;
  });

  return {
    repository: { createQueryBuilder, save: jest.fn(async (v) => v) },
    queries,
  };
}

describe('FoodImageMenuCatalog public menu cache', () => {
  const savedTtl = process.env.FOOD_IMAGE_PUBLIC_MENU_CACHE_TTL_MS;

  afterEach(() => {
    if (savedTtl === undefined) {
      delete process.env.FOOD_IMAGE_PUBLIC_MENU_CACHE_TTL_MS;
    } else {
      process.env.FOOD_IMAGE_PUBLIC_MENU_CACHE_TTL_MS = savedTtl;
    }
  });

  const createCatalog = () => {
    const { repository, queries } = createMenuRepository();
    const catalog = new FoodImageMenuCatalog(repository as any);
    return { catalog, repository, queries };
  };

  it('returns public and personal menus in menu id order like the old single query', async () => {
    const { catalog } = createCatalog();

    const menus = await catalog.getCandidateMenus(7);

    expect(menus.map((menu) => menu.id)).toEqual([1, 3, 5, 9, 12]);
    expect(menus[0]).toEqual({
      ownerUserId: null,
      id: 1,
      name: '밥',
      brand: null,
      category: null,
      weight: 210,
      unit: 0,
    });
    expect(menus[1].ownerUserId).toBe(7);
    expect(menus[3].weight).toBeNull();
  });

  it('reads public menus once and personal menus on every request', async () => {
    const { catalog, queries } = createCatalog();

    await catalog.getCandidateMenus(7);
    const otherUserMenus = await catalog.getCandidateMenus(8);

    expect(queries.map((query) => query.where)).toEqual([
      'user.id IS NULL',
      'user.id = :userId',
      'user.id = :userId',
    ]);
    expect(otherUserMenus.map((menu) => menu.id)).toEqual([1, 5, 9]);
  });

  it('returns a new array each time so one request cannot reorder another', async () => {
    const { catalog } = createCatalog();

    const first = await catalog.getCandidateMenus(7);
    first.splice(0, 1);
    const second = await catalog.getCandidateMenus(7);

    expect(second.map((menu) => menu.id)).toEqual([1, 3, 5, 9, 12]);
  });

  it('reloads public menus after a CSV menu import', async () => {
    const { catalog, repository, queries } = createCatalog();
    // HomeService.importMenusCsv가 같은 catalog를 무효화하는지 본다.
    const service = Object.create(HomeService.prototype) as any;
    service.menuRepository = repository;
    service.foodImageMenuCatalog = catalog;
    service.decodeCsvBuffer = () => '';
    service.parseCsv = () => [['메뉴'], ['현미밥']];
    service.toMenuFromCsvRow = () => ({ name: '현미밥' });

    await catalog.getCandidateMenus(7);
    await service.importMenusCsv({ buffer: Buffer.from('') });
    await catalog.getCandidateMenus(7);

    expect(
      queries.filter((query) => query.where === 'user.id IS NULL'),
    ).toHaveLength(2);
  });

  it('reads menus by id in the requested order', async () => {
    const rows = [
      {
        ownerUserId: null,
        id: 9,
        name: '라면',
        brand: '농심',
        category: null,
        weight: '120',
        unit: 0,
      },
      {
        ownerUserId: 7,
        id: 3,
        name: '내 샐러드',
        brand: null,
        category: null,
        weight: null,
        unit: 0,
      },
    ];
    const builder: any = {
      leftJoin: () => builder,
      select: () => builder,
      where: () => builder,
      andWhere: () => builder,
      getRawMany: async () => rows,
    };
    const catalog = new FoodImageMenuCatalog({
      createQueryBuilder: () => builder,
    } as any);

    const menus = await catalog.getMenusByIds(7, [3, 404, 9]);

    expect(menus.map((menu) => menu.id)).toEqual([3, 9]);
    expect(menus[1].weight).toBe(120);
    expect(await catalog.getMenusByIds(7, [])).toEqual([]);
  });

  it('reads public menus every time when the TTL is 0', async () => {
    process.env.FOOD_IMAGE_PUBLIC_MENU_CACHE_TTL_MS = '0';
    const { catalog, queries } = createCatalog();

    await catalog.getCandidateMenus(7);
    await catalog.getCandidateMenus(7);

    expect(
      queries.filter((query) => query.where === 'user.id IS NULL'),
    ).toHaveLength(2);
  });
});
