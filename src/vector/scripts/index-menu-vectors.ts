import 'dotenv/config';
import { HttpService } from '@nestjs/axios';
import { DataSource } from 'typeorm';
import mysqlDataSource from '../../config/typeorm.datasource';
import { MenuEntity } from '../../home/entity/menu.entity';
import { EmbeddingService } from '../embedding.service';
import { MenuVectorService } from '../menu-vector.service';
import { createVectorDataSourceOptions } from '../vector-db-options';

const createVectorDataSource = (): DataSource =>
  new DataSource(createVectorDataSourceOptions());

const getNumberOption = (
  name: string,
  fallback: number,
  minimum: number,
): number => {
  const parsed = Number(process.env[name]);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(Math.floor(parsed), minimum);
};

const getBooleanOption = (name: string, fallback: boolean): boolean => {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
};

const sleep = async (milliseconds: number): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, milliseconds));

const runWithRetry = async <T>(
  task: () => Promise<T>,
  retryCount: number,
  retryDelayMs: number,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt === retryCount) {
        break;
      }

      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError;
};

const indexMenus = async (): Promise<void> => {
  const batchSize = getNumberOption('VECTOR_INDEX_BATCH_SIZE', 100, 1);
  const startAfterId = getNumberOption('VECTOR_INDEX_START_AFTER_ID', 0, 0);
  const stopAfterId = getNumberOption(
    'VECTOR_INDEX_STOP_AFTER_ID',
    Number.MAX_SAFE_INTEGER,
    1,
  );
  const skipExisting = getBooleanOption('VECTOR_INDEX_SKIP_EXISTING', true);
  const retryCount = getNumberOption('VECTOR_INDEX_RETRY_COUNT', 2, 0);
  const retryDelayMs = getNumberOption('VECTOR_INDEX_RETRY_DELAY_MS', 1000, 0);
  const throttleMs = getNumberOption('VECTOR_INDEX_THROTTLE_MS', 0, 0);
  const vectorDataSource = createVectorDataSource();

  await mysqlDataSource.initialize();
  await vectorDataSource.initialize();

  const menuRepository = mysqlDataSource.getRepository(MenuEntity);
  const embeddingService = new EmbeddingService(new HttpService());
  const menuVectorService = new MenuVectorService(
    vectorDataSource,
    embeddingService,
  );

  let cursor = startAfterId;
  let indexedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let batchCount = 0;
  const startedAt = Date.now();

  console.log('[VECTOR_INDEX] started', {
    batchSize,
    startAfterId,
    stopAfterId:
      stopAfterId === Number.MAX_SAFE_INTEGER ? null : stopAfterId,
    skipExisting,
    retryCount,
    retryDelayMs,
    throttleMs,
  });

  try {
    for (;;) {
      batchCount += 1;
      const menus = await menuRepository
        .createQueryBuilder('menu')
        .leftJoinAndSelect('menu.user', 'user')
        .where('menu.id > :cursor', { cursor })
        .andWhere('menu.id <= :stopAfterId', { stopAfterId })
        .orderBy('menu.id', 'ASC')
        .take(batchSize)
        .getMany();

      if (menus.length === 0) {
        break;
      }

      const existingMenuIds = skipExisting
        ? await menuVectorService.findIndexedMenuIds(
            menus.map((menu) => menu.id),
          )
        : new Set<number>();
      let batchIndexedCount = 0;
      let batchSkippedCount = 0;
      let batchFailedCount = 0;

      for (const menu of menus) {
        if (existingMenuIds.has(menu.id)) {
          skippedCount += 1;
          batchSkippedCount += 1;
          continue;
        }

        try {
          await runWithRetry(
            async () => await menuVectorService.upsertMenu(menu),
            retryCount,
            retryDelayMs,
          );
          indexedCount += 1;
          batchIndexedCount += 1;
        } catch (error) {
          failedCount += 1;
          batchFailedCount += 1;
          console.error('[VECTOR_INDEX] failed', {
            menuId: menu.id,
            menuName: menu.name,
            message: error instanceof Error ? error.message : String(error),
          });
        }

        if (throttleMs > 0) {
          await sleep(throttleMs);
        }
      }

      cursor = menus[menus.length - 1].id;
      console.log('[VECTOR_INDEX] batch completed', {
        batchCount,
        cursor,
        batchIndexedCount,
        batchSkippedCount,
        batchFailedCount,
        indexedCount,
        skippedCount,
        failedCount,
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
      });
    }

    console.log('[VECTOR_INDEX] completed', {
      indexedCount,
      skippedCount,
      failedCount,
      lastCursor: cursor,
      elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    });
  } finally {
    await vectorDataSource.destroy();
    await mysqlDataSource.destroy();
  }
};

indexMenus().catch((error) => {
  console.error('[VECTOR_INDEX] aborted', error);
  process.exit(1);
});
