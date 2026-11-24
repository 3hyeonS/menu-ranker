// 카카오 지점 메뉴 영양 추정(#41) CLI 공용 입력: 카카오 구 폴더, 브랜드 공식 메뉴 CSV, 식약처 음식 메뉴.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseCsv, readLines } from '../crawl-common/crawl-files';
import {
  BranchFolderInput,
  parseMenuRows,
  parseRestaurantRows,
  planBranchImport,
} from './kakao-branch-import-plan';
import { BrandRestaurant, KakaoBrandMatcher } from './kakao-brand-matcher';
import { readPlaces } from './kakao-places-reader';
import {
  BranchMenuRow,
  MfdsMenu,
  parseReferenceMenus,
  ReferenceMenu,
  toMfdsMenu,
} from './kakao-menu-nutrition';

export function readCsvFile(path: string): string[][] {
  return parseCsv(readFileSync(path, 'utf8').replace(/^﻿/, ''));
}

export function readReferenceMenus(path: string): ReferenceMenu[] {
  if (!existsSync(path)) {
    throw new Error(`근거 메뉴 CSV가 없습니다: ${path}`);
  }
  return parseReferenceMenus(readCsvFile(path));
}

/** 근거 CSV의 브랜드명(가짜 id). --brands-file이 없을 때 지점 브랜드 매칭에 쓴다. */
export function brandsFromReferences(
  references: readonly ReferenceMenu[],
): BrandRestaurant[] {
  return [...new Set(references.map((menu) => menu.brand).filter(Boolean))].map(
    (name, index) => ({ id: index + 1, name }),
  );
}

/** --brands-file: 한 줄에 브랜드명 하나(restaurant:branch-import와 같은 형식). */
export function readBrandsFile(path: string): BrandRestaurant[] {
  return [...new Set(readLines(path).map((line) => line.trim()))]
    .filter(Boolean)
    .map((name, index) => ({ id: index + 1, name }));
}

export interface KakaoMenuInput {
  /** 개인 식당(브랜드 미연결) 지점 메뉴. 앱에 추정값을 내보내는 대상이다. */
  independentRows: BranchMenuRow[];
  /** 브랜드 연결 지점 메뉴(평가용). brand는 매칭된 브랜드명. */
  brandRows: Array<BranchMenuRow & { brand: string }>;
  categoryByPlaceId: Map<string, string | null>;
  independentPlaceCount: number;
  brandPlaceCount: number;
}

/**
 * restaurant:branch-import와 같은 기준(planBranchImport)으로 적재 대상 장소를 고르고,
 * 장소마다 그 장소를 고른 폴더의 menus.csv 메뉴만 읽는다(구 경계 장소 중복 방지).
 */
export function readKakaoMenus(
  dirs: readonly string[],
  brands: readonly BrandRestaurant[],
): KakaoMenuInput {
  const missing = dirs.flatMap((dir) =>
    ['places.jsonl', 'restaurants.csv', 'menus.csv', 'menu-done.txt']
      .map((file) => join(dir, file))
      .filter((path) => !existsSync(path)),
  );
  if (missing.length > 0) {
    throw new Error(`입력 파일이 없습니다: ${missing.join(', ')}`);
  }

  const folders: BranchFolderInput[] = dirs.map((dir) => ({
    places: readPlaces([join(dir, 'places.jsonl')]).places,
    restaurants: parseRestaurantRows(readCsvFile(join(dir, 'restaurants.csv')))
      .restaurants,
    menuDoneIds: new Set(
      readLines(join(dir, 'menu-done.txt')).map((id) => id.trim()),
    ),
  }));
  const plan = planBranchImport(folders, new KakaoBrandMatcher(brands));
  const brandNameById = new Map(brands.map((brand) => [brand.id, brand.name]));
  const listed = plan.targets.filter((target) => target.listed);
  const categoryByPlaceId = new Map(
    listed.map((target) => [target.place.id, target.place.category]),
  );

  const input: KakaoMenuInput = {
    independentRows: [],
    brandRows: [],
    categoryByPlaceId,
    independentPlaceCount: 0,
    brandPlaceCount: 0,
  };
  dirs.forEach((dir, folderIndex) => {
    const { menusByPlaceId } = parseMenuRows(
      readCsvFile(join(dir, 'menus.csv')),
    );
    for (const target of listed) {
      if (target.folderIndex !== folderIndex) continue;
      const menus = menusByPlaceId.get(target.place.id) ?? [];
      if (target.restaurantId == null) {
        input.independentPlaceCount += 1;
        for (const menu of menus) {
          input.independentRows.push({
            placeId: target.place.id,
            name: menu.name,
          });
        }
      } else {
        input.brandPlaceCount += 1;
        const brand = brandNameById.get(target.restaurantId);
        for (const menu of menus) {
          input.brandRows.push({
            placeId: target.place.id,
            name: menu.name,
            brand,
          });
        }
      }
    }
  });
  return input;
}

/** --mfds-file: 식약처 음식 메뉴 JSON 배열(DB SELECT 결과 형식, 키는 menu 테이블 컬럼명). */
export function readMfdsFile(path: string): MfdsMenu[] {
  const rows = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(rows)) {
    throw new Error(`식약처 메뉴 파일은 JSON 배열이어야 합니다: ${path}`);
  }
  return rows
    .map((row) => toMfdsMenu(row as Record<string, unknown>))
    .filter((menu): menu is MfdsMenu => menu != null);
}

export const MFDS_MENU_SELECT_SQL = `SELECT id, name, unit, weight, unit_quantity, calories, carbs, protein, fat, sugars, sat_fat
  FROM menu
  WHERE data_source = 0 AND is_deleted = 0 AND userId IS NULL AND name LIKE '(식약처\\_음식)%'`;

/** DB(menu 테이블)에서 식약처 음식 메뉴를 읽기 전용 트랜잭션으로 읽는다. */
export async function readMfdsFromDatabase(): Promise<MfdsMenu[]> {
  const { default: dataSource } =
    await import('../../src/config/typeorm.datasource');
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  try {
    await runner.query('START TRANSACTION READ ONLY');
    const rows = (await runner.query(MFDS_MENU_SELECT_SQL)) as Array<
      Record<string, unknown>
    >;
    await runner.query('COMMIT');
    return rows
      .map(toMfdsMenu)
      .filter((menu): menu is MfdsMenu => menu != null);
  } finally {
    await runner.release();
    await dataSource.destroy();
  }
}
