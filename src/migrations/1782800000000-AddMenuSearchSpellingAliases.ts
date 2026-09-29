import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMenuSearchSpellingAliases1782800000000 implements MigrationInterface {
  name = 'AddMenuSearchSpellingAliases1782800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`menu\`
      SET \`canonical_name\` = REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(\`canonical_name\`, '만두국', '만둣국'),
            '초콜렛', '초콜릿'
          ),
          '브라보', '부라보'
        ),
        '짱아찌', '장아찌'
      )
      WHERE \`canonical_name\` IS NOT NULL
        AND (
          \`canonical_name\` LIKE '%만두국%'
          OR \`canonical_name\` LIKE '%초콜렛%'
          OR \`canonical_name\` LIKE '%브라보%'
          OR \`canonical_name\` LIKE '%짱아찌%'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`menu\`
      SET \`canonical_name\` = CASE
        WHEN \`search_name\` LIKE '%만두국%'
          THEN REPLACE(\`canonical_name\`, '만둣국', '만두국')
        WHEN \`search_name\` LIKE '%초콜렛%'
          THEN REPLACE(\`canonical_name\`, '초콜릿', '초콜렛')
        WHEN \`search_name\` LIKE '%브라보%'
          THEN REPLACE(\`canonical_name\`, '부라보', '브라보')
        WHEN \`search_name\` LIKE '%짱아찌%'
          THEN REPLACE(\`canonical_name\`, '장아찌', '짱아찌')
        ELSE \`canonical_name\`
      END
      WHERE \`canonical_name\` IS NOT NULL
        AND (
          \`search_name\` LIKE '%만두국%'
          OR \`search_name\` LIKE '%초콜렛%'
          OR \`search_name\` LIKE '%브라보%'
          OR \`search_name\` LIKE '%짱아찌%'
        )
    `);
  }
}
