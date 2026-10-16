import { MigrationInterface, QueryRunner } from 'typeorm';

const DUNKIN_BEVERAGES = [
  'IB 카라멜마끼아또',
  'IB 카페모카',
  '디카페인 카라멜마끼아또 (R)',
  '디카페인 카라멜마끼아또 (S)',
  '디카페인 카페모카 (R)',
  '디카페인 카페모카 (S)',
  '로우슈거 핫초코 (R)',
  '에티오피아(Drip Coffee)',
  '자이언트 버킷 피치',
  '초코 (R)',
  '초코 (S)',
  '카라멜마끼아또 (R)',
  '카라멜마끼아또 (S)',
  '카페모카 (R)',
  '카페모카 (S)',
  '케냐(Drip Coffee)',
  '히비스커스 애플티',
] as const;

export class FixRestaurantMenuRecommendationCategories1783300000000 implements MigrationInterface {
  name = 'FixRestaurantMenuRecommendationCategories1783300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`restaurant_menu\` AS rm
      INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
      SET rm.\`menu_category\` = '사이드'
      WHERE r.\`name\` = '버거킹'
        AND rm.\`name\` IN ('딥 트러플 프라이', '크리스퍼 텐더')
    `);
    await queryRunner.query(`
      UPDATE \`restaurant_menu\` AS rm
      INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
      SET rm.\`menu_category\` = '음료', rm.\`unit\` = 1, rm.\`unit_quantity\` = '잔'
      WHERE (r.\`name\` = '버거킹' AND rm.\`name\` = '킹플로트 소다')
         OR (r.\`name\` = '샐러디' AND rm.\`name\` = '스프라이트제로')
    `);
    await queryRunner.query(
      `
        UPDATE \`restaurant_menu\` AS rm
        INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
        SET rm.\`menu_category\` = '음료', rm.\`unit\` = 1, rm.\`unit_quantity\` = '잔'
        WHERE r.\`name\` = '던킨도너츠' AND rm.\`name\` IN (${DUNKIN_BEVERAGES.map(() => '?').join(', ')})
      `,
      [...DUNKIN_BEVERAGES],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`restaurant_menu\` AS rm
      INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
      SET rm.\`menu_category\` = '추천메뉴'
      WHERE r.\`name\` = '버거킹'
        AND rm.\`name\` IN ('딥 트러플 프라이', '크리스퍼 텐더')
    `);
    await queryRunner.query(`
      UPDATE \`restaurant_menu\` AS rm
      INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
      SET rm.\`menu_category\` = CASE
            WHEN r.\`name\` = '샐러디' THEN '수프·스튜'
            ELSE '추천메뉴'
          END,
          rm.\`unit\` = 0,
          rm.\`unit_quantity\` = '인분'
      WHERE (r.\`name\` = '버거킹' AND rm.\`name\` = '킹플로트 소다')
         OR (r.\`name\` = '샐러디' AND rm.\`name\` = '스프라이트제로')
    `);
    await queryRunner.query(
      `
        UPDATE \`restaurant_menu\` AS rm
        INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
        SET rm.\`menu_category\` = '푸드', rm.\`unit\` = 0, rm.\`unit_quantity\` = '인분'
        WHERE r.\`name\` = '던킨도너츠' AND rm.\`name\` IN (${DUNKIN_BEVERAGES.map(() => '?').join(', ')})
      `,
      [...DUNKIN_BEVERAGES],
    );
  }
}
