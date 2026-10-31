import 'reflect-metadata';
import { resolve } from 'path';
import { In } from 'typeorm';
import dataSource from '../src/config/typeorm.datasource';
import { RestaurantBranchEntity } from '../src/restaurant/entity/restaurant-branch.entity';
import { RestaurantEntity } from '../src/restaurant/entity/restaurant.entity';
import { arg } from './crawl-common/crawl-cli';
import { readLines } from './crawl-common/crawl-files';
import {
  BrandMatchSource,
  BrandRestaurant,
  KakaoBrandMatcher,
  KakaoPlace,
  parseKakaoPlaceLine,
} from './kakao-map/kakao-brand-matcher';

// 카카오 수집 장소(places.jsonl)를 등록 브랜드에 매칭해 restaurant_branch에 upsert한다.
// 입력에 있는 장소만 건드린다. 매칭이 풀린 장소는 restaurant_id를 NULL로 바꾼다.

interface MatchedPlace {
  place: KakaoPlace;
  restaurantId: number;
  source: BrandMatchSource;
}

function readPlaces(paths: string[]): {
  places: KakaoPlace[];
  invalidLineCount: number;
  duplicateCount: number;
} {
  const placeById = new Map<string, KakaoPlace>();
  let invalidLineCount = 0;
  let duplicateCount = 0;

  for (const path of paths) {
    for (const line of readLines(path)) {
      let place: KakaoPlace | null = null;
      try {
        place = parseKakaoPlaceLine(line);
      } catch {
        place = null;
      }
      if (!place) {
        invalidLineCount += 1;
        continue;
      }
      // 구 경계에 걸친 장소는 두 구 파일에 모두 있을 수 있다. 처음 것을 쓴다.
      if (placeById.has(place.id)) {
        duplicateCount += 1;
        continue;
      }
      placeById.set(place.id, place);
    }
  }

  return { places: [...placeById.values()], invalidLineCount, duplicateCount };
}

/** --brands-file: 한 줄에 브랜드명 하나. DB 없이 매칭 결과만 미리 볼 때 쓴다(가짜 id). */
function readBrandsFile(path: string): BrandRestaurant[] {
  return [...new Set(readLines(path).map((line) => line.trim()))].map(
    (name, index) => ({ id: index + 1, name }),
  );
}

function summarize(
  places: KakaoPlace[],
  matches: MatchedPlace[],
  restaurants: BrandRestaurant[],
): void {
  const nameById = new Map(restaurants.map((r) => [r.id, r.name]));
  const countByBrand: Record<string, number> = {};
  const countBySource: Record<BrandMatchSource, number> = {
    category: 0,
    name: 0,
  };
  for (const match of matches) {
    const brand =
      nameById.get(match.restaurantId) ?? String(match.restaurantId);
    countByBrand[brand] = (countByBrand[brand] ?? 0) + 1;
    countBySource[match.source] += 1;
  }
  const unmatchedBrands = restaurants
    .map((restaurant) => restaurant.name)
    .filter((name) => !countByBrand[name]);

  console.log('[RESTAURANT_BRANCH_IMPORT] match summary', {
    placeCount: places.length,
    matchedCount: matches.length,
    countBySource,
    countByBrand,
    unmatchedBrands,
  });
  // 이름(첫 단어)으로만 잡힌 장소는 오탐 가능성이 있어 전부 출력해 검수한다.
  for (const match of matches.filter((m) => m.source === 'name')) {
    console.log(
      `[RESTAURANT_BRANCH_IMPORT] name match: ${match.place.id}\t${match.place.name}\t${match.place.category ?? ''}\t-> ${nameById.get(match.restaurantId)}`,
    );
  }
}

async function importBranches(
  places: KakaoPlace[],
  matches: MatchedPlace[],
): Promise<{ upsertedCount: number; unlinkedCount: number }> {
  const matchedIds = new Set(matches.map((match) => match.place.id));
  const unmatchedIds = places
    .map((place) => place.id)
    .filter((id) => !matchedIds.has(id));
  let unlinkedCount = 0;

  await dataSource.transaction(async (manager) => {
    const chunkSize = 500;
    for (let index = 0; index < matches.length; index += chunkSize) {
      await manager.upsert(
        RestaurantBranchEntity,
        matches.slice(index, index + chunkSize).map((match) => ({
          kakaoPlaceId: match.place.id,
          restaurantId: match.restaurantId,
          placeName: match.place.name,
          address: match.place.address,
          kakaoCategory: match.place.category,
          matchSource: match.source,
        })),
        ['kakaoPlaceId'],
      );
    }

    for (let index = 0; index < unmatchedIds.length; index += chunkSize) {
      const result = await manager.update(
        RestaurantBranchEntity,
        {
          kakaoPlaceId: In(unmatchedIds.slice(index, index + chunkSize)),
        },
        { restaurantId: null, matchSource: null },
      );
      unlinkedCount += result.affected ?? 0;
    }
  });

  return { upsertedCount: matches.length, unlinkedCount };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate-only');
  const brandsFile = arg('brands-file');
  const paths = args
    .filter((argument) => !argument.startsWith('--'))
    .map((path) => resolve(process.cwd(), path));
  if (paths.length === 0) {
    throw new Error(
      'places.jsonl 경로를 하나 이상 지정해야 합니다. 예: npm run restaurant:branch-import -- <구>/places.jsonl ... --validate-only',
    );
  }
  if (brandsFile && !validateOnly) {
    throw new Error('--brands-file은 --validate-only와 함께만 쓸 수 있습니다.');
  }

  const { places, invalidLineCount, duplicateCount } = readPlaces(paths);
  console.log('[RESTAURANT_BRANCH_IMPORT] places loaded', {
    fileCount: paths.length,
    placeCount: places.length,
    invalidLineCount,
    duplicateCount,
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

    const matcher = new KakaoBrandMatcher(restaurants);
    const matches = places.flatMap((place): MatchedPlace[] => {
      const match = matcher.match(place);
      return match ? [{ place, ...match }] : [];
    });
    summarize(places, matches, restaurants);

    if (!validateOnly) {
      const result = await importBranches(places, matches);
      console.log(
        '[RESTAURANT_BRANCH_IMPORT] database import completed',
        result,
      );
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
