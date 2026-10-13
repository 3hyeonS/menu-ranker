import 'reflect-metadata';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dataSource from '../src/config/typeorm.datasource';
import { RestaurantMenuEntity } from '../src/restaurant/entity/restaurant-menu.entity';
import { RestaurantEntity } from '../src/restaurant/entity/restaurant.entity';

const HEADERS = [
  '메뉴',
  '브랜드',
  '브랜드 카테고리',
  '메뉴 카테고리',
  '중량 단위',
  '중량',
  '단위량',
  '칼로리',
  '탄수화물',
  '당류',
  '당알코올',
  '식이섬유',
  '단백질',
  '지방',
  '포화지방',
  '트랜스지방',
  '불포화지방',
  '나트륨',
  '카페인',
  '칼륨',
  '콜레스테롤',
  '알코올',
] as const;

type CsvHeader = (typeof HEADERS)[number];
type CsvRow = Record<CsvHeader, string>;

interface ParsedRestaurant {
  name: string;
  normalizedName: string;
  category: string | null;
}

interface ParsedMenu {
  restaurantKey: string;
  name: string;
  menuCategory: string | null;
  unit: number;
  weight: number;
  unitQuantity: string;
  calories: number;
  carbs: number | null;
  sugars: number | null;
  sugarAlcohol: number | null;
  dietaryFiber: number | null;
  protein: number | null;
  fat: number | null;
  satFat: number | null;
  transFat: number | null;
  unsatFat: number | null;
  sodium: number | null;
  caffeine: number | null;
  potassium: number | null;
  cholesterol: number | null;
  alcohol: number | null;
  sourceKey: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (quoted) {
    throw new Error('CSV의 따옴표가 닫히지 않았습니다.');
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeBrand(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function requiredText(value: string, label: string, line: number): string {
  const result = value.trim();
  if (!result) {
    throw new Error(`${line}행의 ${label} 값이 비어 있습니다.`);
  }
  return result;
}

function requiredNumber(value: string, label: string, line: number): number {
  const normalized = value.trim().replace(/,/g, '');
  const result = Number(normalized);
  if (!normalized || !Number.isFinite(result) || result < 0) {
    throw new Error(`${line}행의 ${label} 값이 올바르지 않습니다: ${value}`);
  }
  return result;
}

function nullableNumber(
  value: string,
  label: string,
  line: number,
): number | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) {
    return null;
  }
  const result = Number(normalized);
  if (!Number.isFinite(result) || result < 0) {
    throw new Error(`${line}행의 ${label} 값이 올바르지 않습니다: ${value}`);
  }
  return result;
}

function readCatalog(filePath: string): {
  restaurants: ParsedRestaurant[];
  menus: ParsedMenu[];
} {
  const rawRows = parseCsv(
    readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''),
  );
  if (rawRows.length < 2) {
    throw new Error('CSV에 데이터 행이 없습니다.');
  }

  const headers = rawRows[0].map((header) => header.trim());
  if (
    headers.length !== HEADERS.length ||
    HEADERS.some((header, index) => headers[index] !== header)
  ) {
    throw new Error(
      `CSV 헤더가 예상 형식과 다릅니다.\n예상: ${HEADERS.join(',')}\n실제: ${headers.join(',')}`,
    );
  }

  const restaurantMap = new Map<string, ParsedRestaurant>();
  const menus: ParsedMenu[] = [];
  const occurrenceMap = new Map<string, number>();

  rawRows.slice(1).forEach((values, rowIndex) => {
    const line = rowIndex + 2;
    if (values.every((value) => !value.trim())) {
      return;
    }
    if (values.length !== HEADERS.length) {
      throw new Error(
        `${line}행의 열 개수가 ${values.length}개입니다. ${HEADERS.length}개여야 합니다.`,
      );
    }

    const row = Object.fromEntries(
      HEADERS.map((header, index) => [header, values[index] ?? '']),
    ) as CsvRow;
    const name = requiredText(row['메뉴'], '메뉴', line);
    const brand = requiredText(row['브랜드'], '브랜드', line);
    const restaurantKey = normalizeBrand(brand);
    const restaurantCategory = row['브랜드 카테고리'].trim() || null;
    const existingRestaurant = restaurantMap.get(restaurantKey);

    if (
      existingRestaurant?.category &&
      restaurantCategory &&
      existingRestaurant.category !== restaurantCategory
    ) {
      throw new Error(
        `${line}행의 브랜드 ${brand}에 서로 다른 식당 카테고리가 있습니다: ${existingRestaurant.category}, ${restaurantCategory}`,
      );
    }
    if (!existingRestaurant) {
      restaurantMap.set(restaurantKey, {
        name: brand,
        normalizedName: restaurantKey,
        category: restaurantCategory,
      });
    } else if (!existingRestaurant.category && restaurantCategory) {
      existingRestaurant.category = restaurantCategory;
    }

    const unit = requiredNumber(row['중량 단위'], '중량 단위', line);
    if (unit !== 0 && unit !== 1) {
      throw new Error(`${line}행의 중량 단위는 0(g) 또는 1(ml)이어야 합니다.`);
    }

    const canonicalValues = HEADERS.map((header) => row[header].trim());
    const canonical = JSON.stringify(canonicalValues);
    const occurrence = (occurrenceMap.get(canonical) ?? 0) + 1;
    occurrenceMap.set(canonical, occurrence);
    const sourceKey = createHash('sha256')
      .update(`${canonical}:${occurrence}`)
      .digest('hex');

    menus.push({
      restaurantKey,
      name,
      menuCategory: row['메뉴 카테고리'].trim() || null,
      unit,
      weight: requiredNumber(row['중량'], '중량', line),
      unitQuantity: requiredText(row['단위량'], '단위량', line),
      calories: requiredNumber(row['칼로리'], '칼로리', line),
      carbs: nullableNumber(row['탄수화물'], '탄수화물', line),
      sugars: nullableNumber(row['당류'], '당류', line),
      sugarAlcohol: nullableNumber(row['당알코올'], '당알코올', line),
      dietaryFiber: nullableNumber(row['식이섬유'], '식이섬유', line),
      protein: nullableNumber(row['단백질'], '단백질', line),
      fat: nullableNumber(row['지방'], '지방', line),
      satFat: nullableNumber(row['포화지방'], '포화지방', line),
      transFat: nullableNumber(row['트랜스지방'], '트랜스지방', line),
      unsatFat: nullableNumber(row['불포화지방'], '불포화지방', line),
      sodium: nullableNumber(row['나트륨'], '나트륨', line),
      caffeine: nullableNumber(row['카페인'], '카페인', line),
      potassium: nullableNumber(row['칼륨'], '칼륨', line),
      cholesterol: nullableNumber(row['콜레스테롤'], '콜레스테롤', line),
      alcohol: nullableNumber(row['알코올'], '알코올', line),
      sourceKey,
    });
  });

  return { restaurants: [...restaurantMap.values()], menus };
}

async function importCatalog(
  restaurants: ParsedRestaurant[],
  menus: ParsedMenu[],
): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from(RestaurantMenuEntity)
        .execute();
      await manager
        .createQueryBuilder()
        .delete()
        .from(RestaurantEntity)
        .execute();
      await manager.insert(RestaurantEntity, restaurants);

      const savedRestaurants = await manager.find(RestaurantEntity);
      const restaurantIdByKey = new Map(
        savedRestaurants.map((restaurant) => [
          restaurant.normalizedName,
          restaurant.id,
        ]),
      );
      const menuRows = menus.map((menu) => {
        const restaurantId = restaurantIdByKey.get(menu.restaurantKey);
        if (!restaurantId) {
          throw new Error(`식당 ID를 찾지 못했습니다: ${menu.restaurantKey}`);
        }
        const { restaurantKey: _restaurantKey, ...values } = menu;
        return { ...values, restaurantId };
      });

      const chunkSize = 500;
      for (let index = 0; index < menuRows.length; index += chunkSize) {
        await manager.insert(
          RestaurantMenuEntity,
          menuRows.slice(index, index + chunkSize),
        );
      }
    });
  } finally {
    await dataSource.destroy();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate-only');
  const suppliedPath = args.find((argument) => !argument.startsWith('--'));
  const filePath = resolve(
    process.cwd(),
    suppliedPath ?? 'menu-import-template.csv',
  );
  const { restaurants, menus } = readCatalog(filePath);
  const categoryCounts = restaurants.reduce<Record<string, number>>(
    (counts, restaurant) => {
      const category = restaurant.category ?? '(미분류)';
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    },
    {},
  );

  console.log('[RESTAURANT_IMPORT] CSV validation completed', {
    filePath,
    restaurantCount: restaurants.length,
    menuCount: menus.length,
    categoryCounts,
    validateOnly,
  });

  if (!validateOnly) {
    await importCatalog(restaurants, menus);
    console.log('[RESTAURANT_IMPORT] database import completed', {
      restaurantCount: restaurants.length,
      menuCount: menus.length,
    });
  }
}

main().catch((error) => {
  console.error('[RESTAURANT_IMPORT] failed', error);
  process.exitCode = 1;
});
