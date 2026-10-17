import { createHash } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

interface MenuAddition {
  brand: string;
  name: string;
  menuCategory: string;
  unit: number;
  weight: number;
  unitQuantity: string;
  calories: number;
  carbs?: number;
  sugars?: number;
  protein?: number;
  fat?: number;
  satFat?: number;
  sodium?: number;
}

const MENU_ADDITIONS: MenuAddition[] = [
  {
    brand: '던킨도너츠',
    name: '행운경단 먼치킨 세트(7개입)',
    menuCategory: '도넛',
    unit: 0,
    weight: 143,
    unitQuantity: '1세트',
    calories: 600,
    sugars: 29,
    protein: 3,
    fat: 19,
    sodium: 615,
  },
  {
    brand: '던킨도너츠',
    name: '학화 호도 먼치킨 세트(4입)',
    menuCategory: '도넛',
    unit: 0,
    weight: 130,
    unitQuantity: '1세트',
    calories: 420,
    sugars: 32,
    protein: 4,
    fat: 4.4,
    sodium: 420,
  },
  {
    brand: '던킨도너츠',
    name: '미니도넛세트',
    menuCategory: '도넛',
    unit: 0,
    weight: 118,
    unitQuantity: '1세트',
    calories: 496,
    sugars: 22,
    protein: 5.8,
    fat: 11,
    sodium: 610,
  },
  {
    brand: '던킨도너츠',
    name: '디어샌드(5개입)',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 158,
    unitQuantity: '1세트',
    calories: 815,
    sugars: 35,
    protein: 8,
    fat: 26,
    sodium: 85,
  },
  {
    brand: '샐러디',
    name: '프루티 가든 샐러디',
    menuCategory: '샐러드',
    unit: 0,
    weight: 180,
    unitQuantity: '인분',
    calories: 215.9,
    carbs: 26,
    sugars: 16.5,
    protein: 4,
    fat: 10.8,
    satFat: 1.3,
    sodium: 141.4,
  },
  {
    brand: '샐러디',
    name: '바질 카프레제 샌드위치',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 225,
    unitQuantity: '인분',
    calories: 498.9,
    carbs: 52.1,
    sugars: 6.7,
    protein: 18.2,
    fat: 23.5,
    satFat: 8.5,
    sodium: 819.5,
  },
  {
    brand: '샐러디',
    name: '하와이안 잠봉 샌드위치',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 270,
    unitQuantity: '인분',
    calories: 541.5,
    carbs: 72.9,
    sugars: 23.8,
    protein: 19.1,
    fat: 18.8,
    satFat: 5.8,
    sodium: 1016.9,
  },
  {
    brand: '샐러디',
    name: '[프로틴]선데이 아보카도 치킨 샌드위치',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 300,
    unitQuantity: '인분',
    calories: 625.3,
    carbs: 60.3,
    sugars: 9.6,
    protein: 26.3,
    fat: 30.3,
    satFat: 7,
    sodium: 837.1,
  },
  {
    brand: '샐러디',
    name: '선데이 아보카도 쉬림프 샌드위치',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 280,
    unitQuantity: '인분',
    calories: 544.7,
    carbs: 54.6,
    sugars: 7.2,
    protein: 18.4,
    fat: 28.1,
    satFat: 6.2,
    sodium: 940,
  },
  {
    brand: '샐러디',
    name: '[프로틴]멜팅치즈 치킨 샌드위치',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 250,
    unitQuantity: '인분',
    calories: 684.3,
    carbs: 52.4,
    sugars: 5.4,
    protein: 37.2,
    fat: 35.4,
    satFat: 13.4,
    sodium: 1209.3,
  },
  {
    brand: '샐러디',
    name: '[프로틴]멜팅치즈 비프 샌드위치',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 255,
    unitQuantity: '인분',
    calories: 748.4,
    carbs: 56.3,
    sugars: 9.6,
    protein: 34.1,
    fat: 41.7,
    satFat: 15.9,
    sodium: 1177.1,
  },
  {
    brand: '샐러디',
    name: '[프로틴]멜팅치즈 우삼겹 샌드위치',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 270,
    unitQuantity: '인분',
    calories: 747.3,
    carbs: 55.8,
    sugars: 9.6,
    protein: 30.7,
    fat: 43.8,
    satFat: 17,
    sodium: 1264.8,
  },
  {
    brand: '샐러디',
    name: '[그로밋] 오렌지 치즈 치킨 샌드위치',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 270,
    unitQuantity: '인분',
    calories: 487.5,
    carbs: 59.6,
    sugars: 9.6,
    protein: 26,
    fat: 15.8,
    satFat: 6.3,
    sodium: 928,
  },
  {
    brand: '샐러디',
    name: '[그로밋] 오렌지 치즈 연어 샌드위치',
    menuCategory: '샌드위치',
    unit: 0,
    weight: 265,
    unitQuantity: '인분',
    calories: 477.3,
    carbs: 58.5,
    sugars: 10.3,
    protein: 21.5,
    fat: 17.2,
    satFat: 6.1,
    sodium: 908.6,
  },
  {
    brand: '샐러디',
    name: '파인애플',
    menuCategory: '토핑',
    unit: 0,
    weight: 30,
    unitQuantity: '1회',
    calories: 22.8,
    carbs: 5.7,
    sugars: 5.1,
    protein: 0,
    fat: 0,
    satFat: 0,
    sodium: 0.6,
  },
  {
    brand: '샐러디',
    name: '드라이토마토',
    menuCategory: '토핑',
    unit: 0,
    weight: 30,
    unitQuantity: '1회',
    calories: 44.7,
    carbs: 4.6,
    sugars: 2.9,
    protein: 0.5,
    fat: 2.3,
    satFat: 0.5,
    sodium: 0.3,
  },
  {
    brand: '샐러디',
    name: '몬테레이치즈',
    menuCategory: '토핑',
    unit: 0,
    weight: 30,
    unitQuantity: '1회',
    calories: 111.9,
    carbs: 0.2,
    sugars: 0,
    protein: 7.3,
    fat: 9.1,
    satFat: 5.7,
    sodium: 186,
  },
  {
    brand: '샐러디',
    name: '아보카도무스',
    menuCategory: '토핑',
    unit: 0,
    weight: 40,
    unitQuantity: '1회',
    calories: 88.4,
    carbs: 2.4,
    sugars: 0,
    protein: 0.8,
    fat: 8.4,
    satFat: 1.6,
    sodium: 0,
  },
  {
    brand: '크리스피크림도넛',
    name: '(F)오리지널 글레이즈드',
    menuCategory: '도넛',
    unit: 0,
    weight: 47,
    unitQuantity: '1개',
    calories: 210,
    sugars: 12,
    protein: 3,
    satFat: 4,
    sodium: 70,
  },
];

function sourceKey(menu: MenuAddition): string {
  return createHash('sha256')
    .update(`official-menu-addition-v1:${menu.brand}:${menu.name}`)
    .digest('hex');
}

export class AddOfficialRestaurantMenuAdditions1783400000000 implements MigrationInterface {
  name = 'AddOfficialRestaurantMenuAdditions1783400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const menu of MENU_ADDITIONS) {
      const restaurants: Array<{ id: number }> = await queryRunner.query(
        'SELECT `id` FROM `restaurant` WHERE `name` = ? LIMIT 1',
        [menu.brand],
      );
      const restaurantId = restaurants[0]?.id;
      if (!restaurantId) {
        throw new Error(`식당을 찾지 못했습니다: ${menu.brand}`);
      }

      await queryRunner.query(
        `
          INSERT INTO \`restaurant_menu\` (
            \`restaurant_id\`, \`name\`, \`menu_category\`, \`unit\`, \`weight\`,
            \`unit_quantity\`, \`calories\`, \`carbs\`, \`sugars\`,
            \`sugar_alcohol\`, \`dietary_fiber\`, \`protein\`, \`fat\`,
            \`sat_fat\`, \`trans_fat\`, \`unsat_fat\`, \`sodium\`, \`caffeine\`,
            \`potassium\`, \`cholesterol\`, \`alcohol\`, \`source_key\`
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM \`restaurant_menu\`
            WHERE \`restaurant_id\` = ? AND \`name\` = ?
          )
        `,
        [
          restaurantId,
          menu.name,
          menu.menuCategory,
          menu.unit,
          menu.weight,
          menu.unitQuantity,
          menu.calories,
          menu.carbs ?? null,
          menu.sugars ?? null,
          menu.protein ?? null,
          menu.fat ?? null,
          menu.satFat ?? null,
          menu.sodium ?? null,
          sourceKey(menu),
          restaurantId,
          menu.name,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`restaurant_menu\` WHERE \`source_key\` IN (${MENU_ADDITIONS.map(() => '?').join(', ')})`,
      MENU_ADDITIONS.map(sourceKey),
    );
  }
}
