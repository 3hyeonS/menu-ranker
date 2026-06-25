import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMenuSearchColumns1780500000000 implements MigrationInterface {
  name = 'AddMenuSearchColumns1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `menu` ADD `search_name` varchar(255) NULL AFTER `name`',
    );
    await queryRunner.query(
      'ALTER TABLE `menu` ADD `canonical_name` varchar(255) NULL AFTER `search_name`',
    );

    await queryRunner.query(`
      UPDATE \`menu\`
      SET
        \`search_name\` = LOWER(
          REGEXP_REPLACE(
            REPLACE(REPLACE(\`name\`, '(식약처_음식)', ''), '(식약처_가공)', ''),
            '[^0-9A-Za-z가-힣]',
            ''
          )
        ),
        \`canonical_name\` = REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  LOWER(
                    REGEXP_REPLACE(
                      REPLACE(REPLACE(\`name\`, '(식약처_음식)', ''), '(식약처_가공)', ''),
                      '[^0-9A-Za-z가-힣]',
                      ''
                    )
                  ),
                  '계란',
                  '달걀'
                ),
                '후라이',
                '프라이'
              ),
              '소세지',
              '소시지'
            ),
            '쥬스',
            '주스'
          ),
          '돈까스',
          '돈가스'
        )
    `);

    await queryRunner.query(
      'CREATE INDEX `IDX_menu_search_name` ON `menu` (`search_name`)',
    );
    await queryRunner.query(
      'CREATE INDEX `IDX_menu_canonical_name` ON `menu` (`canonical_name`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `IDX_menu_canonical_name` ON `menu`');
    await queryRunner.query('DROP INDEX `IDX_menu_search_name` ON `menu`');
    await queryRunner.query('ALTER TABLE `menu` DROP COLUMN `canonical_name`');
    await queryRunner.query('ALTER TABLE `menu` DROP COLUMN `search_name`');
  }
}
