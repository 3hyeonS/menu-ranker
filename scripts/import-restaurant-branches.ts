import 'reflect-metadata';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { In } from 'typeorm';
import dataSource from '../src/config/typeorm.datasource';
import { RestaurantBranchMenuEntity } from '../src/restaurant/entity/restaurant-branch-menu.entity';
import { RestaurantBranchEntity } from '../src/restaurant/entity/restaurant-branch.entity';
import { RestaurantEntity } from '../src/restaurant/entity/restaurant.entity';
import { arg } from './crawl-common/crawl-cli';
import { parseCsv, readJsonLines, readLines } from './crawl-common/crawl-files';
import {
  BranchFolderInput,
  BranchImportPlan,
  BranchImportTarget,
  KakaoBranchMenu,
  parseMenuRows,
  parseRestaurantRows,
  planBranchImport,
} from './kakao-map/kakao-branch-import-plan';
import {
  BrandMatchSource,
  BrandRestaurant,
  KakaoBrandMatcher,
  KakaoPlace,
  parseKakaoPlace,
} from './kakao-map/kakao-brand-matcher';

// 카카오 수집 구 폴더(places.jsonl·restaurants.csv·menus.csv)를 restaurant_branch·restaurant_branch_menu에 적재한다.
// 적재 대상: restaurants.csv의 장소 전부(개인 식당 포함) + places.jsonl에서 브랜드에 매칭된 장소.
// 장소는 upsert하고 메뉴는 지점 단위로 지우고 다시 넣는다. 입력에 없는 장소는 건드리지 않는다.
// 입력에 있지만 적재 대상이 아닌 장소는 restaurant_id를 NULL로 바꾼다(#31·#30 결정).

// 한 트랜잭션에 쓰는 장소 수와 INSERT 한 번의 행 수. 운영 RDS(버퍼 풀 128MB)에 부담이 적게 나눈다.
const PLACE_CHUNK_SIZE = 1_000;
const ROW_CHUNK_SIZE = 1_000;

interface FolderFiles {
  dir: string;
  placesPath: string;
  restaurantsPath: string;
  menusPath: string;
  menuDonePath: string;
}

function folderFiles(dir: string): FolderFiles {
  return {
    dir,
    placesPath: join(dir, 'places.jsonl'),
    restaurantsPath: join(dir, 'restaurants.csv'),
    menusPath: join(dir, 'menus.csv'),
    menuDonePath: join(dir, 'menu-done.txt'),
  };
}

function readCsvRows(path: string): string[][] {
  return parseCsv(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

function readFolder(files: FolderFiles): {
  input: BranchFolderInput;
  invalidPlaceCount: number;
  invalidRestaurantCount: number;
} {
  const places: KakaoPlace[] = [];
  let invalidPlaceCount = 0;
  // readJsonLines는 JSON이 깨진 줄(중단으로 덜 쓰인 줄)을 건너뛴다.
  for (const row of readJsonLines<unknown>(files.placesPath)) {
    const place = parseKakaoPlace(row);
    if (place) {
      places.push(place);
    } else {
      invalidPlaceCount += 1;
    }
  }
  const { restaurants, invalidRowCount } = parseRestaurantRows(
    readCsvRows(files.restaurantsPath),
  );
  return {
    input: {
      places,
      restaurants,
      menuDoneIds: new Set(
        readLines(files.menuDonePath).map((id) => id.trim()),
      ),
    },
    invalidPlaceCount,
    invalidRestaurantCount: invalidRowCount,
  };
}

/** --brands-file: 한 줄에 브랜드명 하나. DB 없이 매칭 결과만 미리 볼 때 쓴다(가짜 id). */
function readBrandsFile(path: string): BrandRestaurant[] {
  return [...new Set(readLines(path).map((line) => line.trim()))].map(
    (name, index) => ({ id: index + 1, name }),
  );
}

function summarize(
  placeCount: number,
  plan: BranchImportPlan,
  restaurants: BrandRestaurant[],
): void {
  const nameById = new Map(restaurants.map((r) => [r.id, r.name]));
  const countByBrand: Record<string, number> = {};
  const countBySource: Record<BrandMatchSource, number> = {
    category: 0,
    name: 0,
  };
  const matched = plan.targets.filter((target) => target.restaurantId != null);
  for (const target of matched) {
    const brand =
      nameById.get(target.restaurantId) ?? String(target.restaurantId);
    countByBrand[brand] = (countByBrand[brand] ?? 0) + 1;
    countBySource[target.matchSource] += 1;
  }
  const unmatchedBrands = restaurants
    .map((restaurant) => restaurant.name)
    .filter((name) => !countByBrand[name]);

  console.log('[RESTAURANT_BRANCH_IMPORT] plan summary', {
    placeCount,
    targetCount: plan.targets.length,
    independentCount: plan.targets.length - matched.length,
    matchedCount: matched.length,
    // 브랜드로만 들어오고 restaurants.csv에 없어(제외 카테고리) 메뉴를 수집하지 않은 장소.
    matchedWithoutMenuCollectionCount: matched.filter(
      (target) => !target.listed,
    ).length,
    unlinkCount: plan.unlinkPlaceIds.length,
    duplicatePlaceCount: plan.duplicatePlaceCount,
    duplicateRestaurantCount: plan.duplicateRestaurantCount,
    oversizedPlaceCount: plan.oversizedPlaceCount,
    countBySource,
    countByBrand,
    unmatchedBrands,
  });
  // 이름(첫 단어)으로만 잡힌 장소는 오탐 가능성이 있어 전부 출력해 검수한다.
  for (const target of matched.filter((t) => t.matchSource === 'name')) {
    console.log(
      `[RESTAURANT_BRANCH_IMPORT] name match: ${target.place.id}\t${target.place.name}\t${target.place.category ?? ''}\t-> ${nameById.get(target.restaurantId)}`,
    );
  }
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

/**
 * 메뉴를 교체할 장소인지. restaurants.csv에 있고 수집을 마쳤을 때만(menu-done.txt 또는 menus.csv 행) 교체한다.
 * 수집이 실패·미완료인 장소는 지난 적재의 메뉴를 지우지 않고 둔다.
 */
function replacesMenus(
  target: BranchImportTarget,
  menusByPlaceId: ReadonlyMap<string, KakaoBranchMenu[]>,
): boolean {
  return (
    target.listed &&
    (target.menusCollected || menusByPlaceId.has(target.place.id))
  );
}

/** 장소 한 묶음을 한 트랜잭션으로 쓴다. 같은 입력으로 다시 실행해도 결과가 같다. */
async function writeTargets(
  targets: readonly BranchImportTarget[],
  menusByPlaceId: ReadonlyMap<string, KakaoBranchMenu[]>,
): Promise<void> {
  await dataSource.transaction(async (manager) => {
    // manager.upsert()는 이미 있는 행만 갱신되면(insertId 없음) createdAt 등을 다시 읽다가
    // "entity id is not set" 오류가 나므로 updateEntity(false)로 결과 반영을 끈다.
    await manager
      .createQueryBuilder()
      .insert()
      .into(RestaurantBranchEntity)
      .values(
        targets.map((target) => ({
          kakaoPlaceId: target.place.id,
          restaurantId: target.restaurantId,
          placeName: target.place.name,
          address: target.place.address,
          kakaoCategory: target.place.category,
          matchSource: target.matchSource,
        })),
      )
      .orUpdate(
        [
          'restaurant_id',
          'place_name',
          'address',
          'kakao_category',
          'match_source',
        ],
        ['kakao_place_id'],
      )
      .updateEntity(false)
      .execute();
    const branches = await manager.find(RestaurantBranchEntity, {
      where: { kakaoPlaceId: In(targets.map((target) => target.place.id)) },
      select: { id: true, kakaoPlaceId: true },
    });
    const branchIdByPlaceId = new Map(
      branches.map((branch) => [branch.kakaoPlaceId, branch.id]),
    );
    const menuTargets = targets.filter((target) =>
      replacesMenus(target, menusByPlaceId),
    );
    if (menuTargets.length > 0) {
      await manager.delete(RestaurantBranchMenuEntity, {
        branchId: In(
          menuTargets.map((target) => branchIdByPlaceId.get(target.place.id)),
        ),
      });
    }

    const menuRows = menuTargets.flatMap((target) =>
      (menusByPlaceId.get(target.place.id) ?? []).map((menu, sortOrder) => ({
        branchId: branchIdByPlaceId.get(target.place.id),
        sortOrder,
        name: menu.name,
        photoUrl: menu.photoUrl,
      })),
    );
    for (const rows of chunks(menuRows, ROW_CHUNK_SIZE)) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(RestaurantBranchMenuEntity)
        .values(rows)
        .updateEntity(false)
        .execute();
    }
  });
}

async function unlinkPlaces(placeIds: readonly string[]): Promise<number> {
  let unlinkedCount = 0;
  for (const ids of chunks(placeIds, PLACE_CHUNK_SIZE)) {
    const result = await dataSource
      .getRepository(RestaurantBranchEntity)
      .update(
        { kakaoPlaceId: In(ids) },
        { restaurantId: null, matchSource: null },
      );
    unlinkedCount += result.affected ?? 0;
  }
  return unlinkedCount;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate-only');
  const brandsFile = arg('brands-file');
  const dirs = args
    .filter((argument) => !argument.startsWith('--'))
    .map((path) => resolve(process.cwd(), path));
  if (dirs.length === 0) {
    throw new Error(
      '구 폴더를 하나 이상 지정해야 합니다. 예: npm run restaurant:branch-import -- kakao-map/송파구 ... --validate-only',
    );
  }
  if (args.includes('--brands-file')) {
    throw new Error(
      '--brands-file은 --brands-file=<경로> 형식으로 지정합니다.',
    );
  }
  if (brandsFile && !validateOnly) {
    throw new Error('--brands-file은 --validate-only와 함께만 쓸 수 있습니다.');
  }
  // readLines·readJsonLines는 없는 파일을 빈 목록으로 읽으므로, 오타·펼쳐지지 않은 glob·빠진 파일을 여기서 막는다.
  const folders = dirs.map(folderFiles);
  const missingPaths = folders.flatMap((files) =>
    [
      files.placesPath,
      files.restaurantsPath,
      files.menusPath,
      files.menuDonePath,
    ].filter((path) => !existsSync(path)),
  );
  if (missingPaths.length > 0) {
    throw new Error(`입력 파일이 없습니다: ${missingPaths.join(', ')}`);
  }

  // 장소 목록은 작아서(서울 전체 약 10만 곳) 한 번에 읽고, 큰 menus.csv는 폴더마다 읽는다.
  const folderInputs: BranchFolderInput[] = [];
  let invalidPlaceCount = 0;
  let invalidRestaurantCount = 0;
  for (const files of folders) {
    const folder = readFolder(files);
    folderInputs.push(folder.input);
    invalidPlaceCount += folder.invalidPlaceCount;
    invalidRestaurantCount += folder.invalidRestaurantCount;
  }
  const placeCount = new Set(
    folderInputs.flatMap((folder) => [
      ...folder.places.map((place) => place.id),
      ...folder.restaurants.map((place) => place.id),
    ]),
  ).size;
  console.log('[RESTAURANT_BRANCH_IMPORT] folders loaded', {
    folderCount: folders.length,
    placeCount,
    invalidPlaceCount,
    invalidRestaurantCount,
    validateOnly,
  });

  const useDatabase = !brandsFile;
  if (useDatabase) {
    await dataSource.initialize();
  }
  try {
    const restaurants: BrandRestaurant[] = useDatabase
      ? await dataSource.getRepository(RestaurantEntity).find({
          select: { id: true, name: true },
        })
      : readBrandsFile(resolve(process.cwd(), brandsFile));
    if (restaurants.length === 0) {
      throw new Error(
        '브랜드(restaurant)가 0개입니다. restaurant:import 먼저 확인하세요.',
      );
    }

    const plan = planBranchImport(
      folderInputs,
      new KakaoBrandMatcher(restaurants),
    );
    summarize(placeCount, plan, restaurants);

    // 브랜드 해제를 먼저 한다. 뒤의 폴더 적재가 중간에 실패해도 잘못된 브랜드 매핑이 남지 않는다.
    if (!validateOnly) {
      const unlinkedCount = await unlinkPlaces(plan.unlinkPlaceIds);
      console.log('[RESTAURANT_BRANCH_IMPORT] unlinked', { unlinkedCount });
    }
    // restaurants.csv 장소의 메뉴를 읽을 폴더. 구 경계 장소는 처음 폴더 것만 쓴다.
    const menuFolderByPlaceId = new Map(
      plan.targets
        .filter((target) => target.listed)
        .map((target) => [target.place.id, target.folderIndex]),
    );

    const totals = {
      writtenPlaceCount: 0,
      menuCount: 0,
      placesWithMenuCount: 0,
      photoCount: 0,
      invalidMenuRowCount: 0,
      droppedPhotoCount: 0,
      orphanMenuPlaceCount: 0,
      otherFolderMenuPlaceCount: 0,
      // restaurants.csv에 있지만 메뉴 수집이 끝나지 않은 장소. 기존 메뉴를 그대로 둔다.
      menuNotCollectedCount: 0,
    };
    for (const [folderIndex, files] of folders.entries()) {
      const targets = plan.targets.filter(
        (target) => target.folderIndex === folderIndex,
      );
      const menus = parseMenuRows(readCsvRows(files.menusPath));
      totals.invalidMenuRowCount += menus.invalidRowCount;
      totals.droppedPhotoCount += menus.droppedPhotoCount;
      for (const [placeId, placeMenus] of menus.menusByPlaceId) {
        const menuFolder = menuFolderByPlaceId.get(placeId);
        // restaurants.csv에 없는 식당의 메뉴(수집 중 목록이 바뀐 경우 등)는 적재하지 않는다.
        if (menuFolder == null) {
          totals.orphanMenuPlaceCount += 1;
          continue;
        }
        // 다른 구 폴더에서 이미 적재하는 경계 장소.
        if (menuFolder !== folderIndex) {
          totals.otherFolderMenuPlaceCount += 1;
          continue;
        }
        totals.placesWithMenuCount += 1;
        totals.menuCount += placeMenus.length;
        totals.photoCount += placeMenus.filter((menu) => menu.photoUrl).length;
      }

      totals.menuNotCollectedCount += targets.filter(
        (target) =>
          target.listed && !replacesMenus(target, menus.menusByPlaceId),
      ).length;

      if (validateOnly) {
        continue;
      }
      for (const chunk of chunks(targets, PLACE_CHUNK_SIZE)) {
        await writeTargets(chunk, menus.menusByPlaceId);
        totals.writtenPlaceCount += chunk.length;
      }
      console.log(
        `[RESTAURANT_BRANCH_IMPORT] ${files.dir}: ${targets.length} places written (total ${totals.writtenPlaceCount}/${plan.targets.length})`,
      );
    }
    console.log('[RESTAURANT_BRANCH_IMPORT] menu summary', totals);

    if (!validateOnly) {
      console.log('[RESTAURANT_BRANCH_IMPORT] database import completed', {
        writtenPlaceCount: totals.writtenPlaceCount,
        menuCount: totals.menuCount,
      });
    }
  } finally {
    if (useDatabase) {
      await dataSource.destroy();
    }
  }
}

main().catch((error) => {
  console.error('[RESTAURANT_BRANCH_IMPORT] failed', error);
  process.exitCode = 1;
});
