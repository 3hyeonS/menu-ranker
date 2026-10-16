import { MigrationInterface, QueryRunner } from 'typeorm';

const TARGET_BRANDS = [
  'BBQ',
  'BHC',
  'KFC',
  '고피자',
  '굽네치킨',
  '네네치킨',
  '자담치킨',
  '컴포즈커피',
  '파파존스',
  '피자나라치킨공주',
  '피자마루',
  '피자스쿨',
] as const;

const EXPECTED_TARGET_COUNT = 278;

export class NormalizeRestaurantMenuUnitQuantities1783100000000 implements MigrationInterface {
  name = 'NormalizeRestaurantMenuUnitQuantities1783100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const placeholders = TARGET_BRANDS.map(() => '?').join(', ');
    const countRows: Array<{ count: string | number }> =
      await queryRunner.query(
        `
        SELECT COUNT(*) AS \`count\`
        FROM \`restaurant_menu\` AS rm
        INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
        WHERE rm.\`unit_quantity\` = '기준량'
          AND r.\`name\` IN (${placeholders})
      `,
        [...TARGET_BRANDS],
      );
    const targetCount = Number(countRows[0]?.count ?? 0);

    if (targetCount !== EXPECTED_TARGET_COUNT) {
      throw new Error(
        `식당 메뉴 단위량 갱신 대상을 ${EXPECTED_TARGET_COUNT}개 예상했지만 ${targetCount}개를 찾았습니다.`,
      );
    }

    const servingRatioSql = `
      CASE
        WHEN r.\`name\` = 'BHC' AND rm.\`name\` LIKE '%피자%' THEN 1.1
        WHEN r.\`name\` = '네네치킨' AND rm.\`menu_category\` = '피자'
          AND rm.\`name\` LIKE '%(씬)%' THEN 0.82
        WHEN r.\`name\` = '네네치킨' AND rm.\`menu_category\` = '피자' THEN 1.13
        WHEN (r.\`name\`, rm.\`name\`) IN (
          ('BHC', '치킨스넥'),
          ('피자마루', '고추마요 텐더치킨'),
          ('피자스쿨', '치킨스틱&#038;윙 (치킨스틱&윙)'),
          ('피자스쿨', '치킨텐더 (치킨텐더)')
        ) THEN 30 / rm.\`weight\`
        ELSE 1
      END
    `;
    const resizedServingSql = `
      (r.\`name\` = 'BHC' AND rm.\`name\` LIKE '%피자%')
      OR (r.\`name\` = '네네치킨' AND rm.\`menu_category\` = '피자')
      OR (r.\`name\`, rm.\`name\`) IN (
        ('BHC', '치킨스넥'),
        ('피자마루', '고추마요 텐더치킨'),
        ('피자스쿨', '치킨스틱&#038;윙 (치킨스틱&윙)'),
        ('피자스쿨', '치킨텐더 (치킨텐더)')
      )
    `;

    await queryRunner.query(`
      UPDATE \`restaurant_menu\` AS rm
      INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
      SET
        rm.\`calories\` = rm.\`calories\` * (${servingRatioSql}),
        rm.\`carbs\` = rm.\`carbs\` * (${servingRatioSql}),
        rm.\`sugars\` = rm.\`sugars\` * (${servingRatioSql}),
        rm.\`sugar_alcohol\` = rm.\`sugar_alcohol\` * (${servingRatioSql}),
        rm.\`dietary_fiber\` = rm.\`dietary_fiber\` * (${servingRatioSql}),
        rm.\`protein\` = rm.\`protein\` * (${servingRatioSql}),
        rm.\`fat\` = rm.\`fat\` * (${servingRatioSql}),
        rm.\`sat_fat\` = rm.\`sat_fat\` * (${servingRatioSql}),
        rm.\`trans_fat\` = rm.\`trans_fat\` * (${servingRatioSql}),
        rm.\`unsat_fat\` = rm.\`unsat_fat\` * (${servingRatioSql}),
        rm.\`sodium\` = rm.\`sodium\` * (${servingRatioSql}),
        rm.\`caffeine\` = rm.\`caffeine\` * (${servingRatioSql}),
        rm.\`potassium\` = rm.\`potassium\` * (${servingRatioSql}),
        rm.\`cholesterol\` = rm.\`cholesterol\` * (${servingRatioSql}),
        rm.\`alcohol\` = rm.\`alcohol\` * (${servingRatioSql}),
        rm.\`weight\` = CASE
          WHEN r.\`name\` = 'BHC' AND rm.\`name\` LIKE '%피자%' THEN 110
          WHEN r.\`name\` = '네네치킨' AND rm.\`menu_category\` = '피자'
            AND rm.\`name\` LIKE '%(씬)%' THEN 82
          WHEN r.\`name\` = '네네치킨' AND rm.\`menu_category\` = '피자' THEN 113
          ELSE 30
        END,
        rm.\`menu_category\` = CASE
          WHEN r.\`name\` = 'BHC' AND rm.\`name\` LIKE '%피자%' THEN '피자'
          ELSE rm.\`menu_category\`
        END
      WHERE rm.\`unit_quantity\` = '기준량'
        AND (${resizedServingSql})
    `);

    await queryRunner.query(
      `
        UPDATE \`restaurant_menu\` AS rm
        INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
        SET rm.\`unit_quantity\` = CASE
            WHEN rm.\`name\` REGEXP '(^|[ (])[0-9]+[[:space:]]*조각([ )]|$)'
              THEN CONCAT(
                REGEXP_SUBSTR(
                  REGEXP_SUBSTR(rm.\`name\`, '(^|[ (])[0-9]+[[:space:]]*조각([ )]|$)'),
                  '[0-9]+'
                ),
                '조각'
              )
            WHEN rm.\`name\` REGEXP '(^|[ (])[0-9]+[[:space:]]*(개|ea)([ )]|$)'
              THEN CONCAT(
                REGEXP_SUBSTR(
                  REGEXP_SUBSTR(rm.\`name\`, '(^|[ (])[0-9]+[[:space:]]*(개|ea)([ )]|$)'),
                  '[0-9]+'
                ),
                '개'
              )
            WHEN r.\`name\` = '컴포즈커피' AND rm.\`name\` LIKE '%(조각)%'
              THEN '1조각'
            WHEN r.\`name\` = '컴포즈커피'
              THEN '1개'
            WHEN r.\`name\` IN ('BHC', '네네치킨') AND rm.\`menu_category\` = '피자'
              THEN '1조각'
            WHEN (r.\`name\`, rm.\`name\`) IN (
              ('BHC', '치킨스넥'),
              ('피자마루', '고추마요 텐더치킨'),
              ('피자스쿨', '치킨스틱&#038;윙 (치킨스틱&윙)'),
              ('피자스쿨', '치킨텐더 (치킨텐더)')
            )
              THEN '1조각'
            WHEN r.\`name\` = '고피자' AND rm.\`menu_category\` = '피자'
              AND REPLACE(rm.\`name\`, ' ', '') LIKE '%1인피자세트%'
              THEN '인분'
            WHEN r.\`name\` = '고피자' AND rm.\`menu_category\` = '피자'
              AND REPLACE(rm.\`name\`, ' ', '') LIKE '%소스%'
              THEN '1회'
            WHEN r.\`name\` = '고피자' AND rm.\`menu_category\` = '피자'
              THEN '1조각'
            WHEN r.\`name\` = '고피자' AND (
              REPLACE(rm.\`name\`, ' ', '') REGEXP '소스|시즈닝|치즈추가|무스|연유'
            )
              THEN '1회'
            WHEN r.\`name\` = '고피자' AND REPLACE(rm.\`name\`, ' ', '') LIKE '%피클%'
              THEN '1개'
            WHEN r.\`name\` = '고피자'
              THEN '인분'
            WHEN r.\`name\` = '피자스쿨' AND rm.\`menu_category\` = '피자'
              THEN '2조각'
            WHEN rm.\`menu_category\` IN ('소스', '추가토핑 ®')
              OR REPLACE(rm.\`name\`, ' ', '') REGEXP '소스|시즈닝|스프레드|토핑'
              THEN '1회'
            WHEN rm.\`menu_category\` = '피자설기'
              THEN '1개'
            WHEN REPLACE(rm.\`name\`, ' ', '') REGEXP '콜라|사이다|스프라이트|레몬보이|음료'
              THEN '잔'
            ELSE '인분'
          END
        WHERE rm.\`unit_quantity\` = '기준량'
          AND r.\`name\` IN (${placeholders})
      `,
      [...TARGET_BRANDS],
    );

    const remainingRows: Array<{ count: string | number }> =
      await queryRunner.query(
        `
          SELECT COUNT(*) AS \`count\`
          FROM \`restaurant_menu\` AS rm
          INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
          WHERE rm.\`unit_quantity\` = '기준량'
            AND r.\`name\` IN (${placeholders})
        `,
        [...TARGET_BRANDS],
      );

    if (Number(remainingRows[0]?.count ?? 0) !== 0) {
      throw new Error('일부 식당 메뉴의 기준량 표기를 갱신하지 못했습니다.');
    }
  }

  public async down(): Promise<void> {
    // 원본의 모호한 '기준량' 표기로 되돌리면 정보가 손실되므로 복구하지 않는다.
  }
}
