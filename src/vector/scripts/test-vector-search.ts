import 'dotenv/config';
import { HttpService } from '@nestjs/axios';
import { DataSource, In } from 'typeorm';
import mysqlDataSource from '../../config/typeorm.datasource';
import { MenuEntity } from '../../home/entity/menu.entity';
import { EmbeddingService } from '../embedding.service';
import { MenuVectorService } from '../menu-vector.service';

const createVectorDataSource = (): DataSource =>
  new DataSource({
    type: 'postgres',
    host: process.env.VECTOR_DB_HOST ?? 'localhost',
    port: Number(process.env.VECTOR_DB_PORT ?? 5432),
    username: process.env.VECTOR_DB_USERNAME ?? 'vector_user',
    password: process.env.VECTOR_DB_PASSWORD ?? 'vector_password',
    database: process.env.VECTOR_DB_NAME ?? 'melo_vector',
    synchronize: false,
    logging: false,
  });

const asNullableNumber = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

const testVectorSearch = async (): Promise<void> => {
  const query =
    process.env.VECTOR_TEST_QUERY ??
    '가볍게 먹을만한 버거 메뉴 추천해줘';
  const userId = Number(process.env.VECTOR_TEST_USER_ID ?? 0);
  const limit = Number(process.env.VECTOR_TEST_LIMIT ?? 10);
  const brand = process.env.VECTOR_TEST_BRAND ?? null;
  const category = process.env.VECTOR_TEST_CATEGORY ?? null;
  const maxCalories = asNullableNumber(process.env.VECTOR_TEST_MAX_CALORIES);
  const minProtein = asNullableNumber(process.env.VECTOR_TEST_MIN_PROTEIN);
  const vectorDataSource = createVectorDataSource();

  await mysqlDataSource.initialize();
  await vectorDataSource.initialize();

  const menuRepository = mysqlDataSource.getRepository(MenuEntity);
  const embeddingService = new EmbeddingService(new HttpService());
  const menuVectorService = new MenuVectorService(
    vectorDataSource,
    embeddingService,
  );

  try {
    console.log('[VECTOR_TEST] query', {
      query,
      userId,
      limit,
      brand,
      category,
      maxCalories,
      minProtein,
    });

    const vectorStartedAt = Date.now();
    const vectorResults = await menuVectorService.searchMenusByText(query, {
      userId,
      limit,
      brand,
      category,
      maxCalories,
      minProtein,
    });
    const vectorElapsedMs = Date.now() - vectorStartedAt;

    const menuIds = vectorResults.map((result) => result.menuId);
    const mysqlStartedAt = Date.now();
    const menus = menuIds.length
      ? await menuRepository.find({
          where: {
            id: In(menuIds),
          },
        })
      : [];
    const mysqlElapsedMs = Date.now() - mysqlStartedAt;
    const menuMap = new Map(menus.map((menu) => [menu.id, menu]));

    const rows = vectorResults.map((result, index) => {
      const menu = menuMap.get(result.menuId);

      return {
        rank: index + 1,
        menu_id: result.menuId,
        distance: Number(result.distance.toFixed(6)),
        name: menu?.name ?? null,
        brand: menu?.brand ?? null,
        category: menu?.category ?? null,
        calories: menu?.calories ?? null,
        carbs: menu?.carbs ?? null,
        protein: menu?.protein ?? null,
        fat: menu?.fat ?? null,
      };
    });

    console.table(rows);
    console.log('[VECTOR_TEST] completed', {
      resultCount: rows.length,
      vectorElapsedMs,
      mysqlElapsedMs,
      totalElapsedMs: vectorElapsedMs + mysqlElapsedMs,
    });
  } finally {
    await vectorDataSource.destroy();
    await mysqlDataSource.destroy();
  }
};

testVectorSearch().catch((error) => {
  console.error('[VECTOR_TEST] aborted', error);
  process.exit(1);
});
