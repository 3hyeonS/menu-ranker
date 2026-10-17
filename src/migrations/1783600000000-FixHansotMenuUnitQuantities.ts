import { MigrationInterface, QueryRunner } from 'typeorm';

const UNIT_QUANTITIES: Record<string, string> = {
  '미니 찹쌀핫도그': '4개',
  '뉴 감자고로케': '3개',
  '해시 포테이토 스틱': '5개',
  '허니버터 해시 포테이토 스틱': '5개',
  '치즈버터 해시 포테이토 스틱': '5개',
  '반찬 치킨': '5개',
  '한솥 조미김': '1개',
  '반찬 토네이도 소세지': '1개',
  '반찬 고등어 데리야끼': '1개',
  '제주녹차 미니꿀호떡': '1개',
};

export class FixHansotMenuUnitQuantities1783600000000 implements MigrationInterface {
  name = 'FixHansotMenuUnitQuantities1783600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const countRows: Array<{ count: string | number }> =
      await queryRunner.query(`
        SELECT COUNT(*) AS \`count\`
        FROM \`restaurant_menu\` AS rm
        INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
        WHERE r.\`name\` = '한솥'
      `);

    if (Number(countRows[0]?.count ?? 0) !== 111) {
      throw new Error('한솥 메뉴 단위량 갱신 대상을 111개 찾지 못했습니다.');
    }

    const names = Object.keys(UNIT_QUANTITIES);
    const unitCases = names.map(() => 'WHEN rm.`name` = ? THEN ?').join(' ');
    const unitParams = names.flatMap((name) => [name, UNIT_QUANTITIES[name]]);

    await queryRunner.query(
      `
        UPDATE \`restaurant_menu\` AS rm
        INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
        SET rm.\`unit_quantity\` = CASE
          ${unitCases}
          WHEN rm.\`menu_category\` = '소스' THEN '1회'
          ELSE '인분'
        END
        WHERE r.\`name\` = '한솥'
      `,
      unitParams,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`restaurant_menu\` AS rm
      INNER JOIN \`restaurant\` AS r ON r.\`id\` = rm.\`restaurant_id\`
      SET rm.\`unit_quantity\` = '1인분'
      WHERE r.\`name\` = '한솥'
    `);
  }
}
