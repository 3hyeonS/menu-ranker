import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceLegacyWorkoutClassificationColumns1781220000000
  implements MigrationInterface
{
  name = 'ReplaceLegacyWorkoutClassificationColumns1781220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasColumn('workout', 'equipment_original_detail'))
    ) {
      await queryRunner.query(`
        ALTER TABLE \`workout\`
        ADD \`equipment_original_detail\` varchar(255) NULL
      `);
    }

    if (await queryRunner.hasColumn('workout', 'equipments')) {
      await queryRunner.query(`
        UPDATE \`workout\`
        SET \`equipment_original_detail\` = \`equipments\`
        WHERE (\`equipment_original_detail\` IS NULL
          OR TRIM(\`equipment_original_detail\`) = '')
          AND \`equipments\` IS NOT NULL
          AND TRIM(\`equipments\`) <> ''
      `);
      await queryRunner.query(`
        ALTER TABLE \`workout\`
        DROP COLUMN \`equipments\`
      `);
    }

    if (await queryRunner.hasColumn('workout', 'body_parts')) {
      await queryRunner.query(`
        ALTER TABLE \`workout\`
        DROP COLUMN \`body_parts\`
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('workout', 'equipments'))) {
      await queryRunner.query(`
        ALTER TABLE \`workout\`
        ADD \`equipments\` varchar(255) NULL
      `);
      await queryRunner.query(`
        UPDATE \`workout\`
        SET \`equipments\` = \`equipment_original_detail\`
        WHERE \`equipment_original_detail\` IS NOT NULL
      `);
    }

    if (!(await queryRunner.hasColumn('workout', 'body_parts'))) {
      await queryRunner.query(`
        ALTER TABLE \`workout\`
        ADD \`body_parts\` text NULL
      `);
      await queryRunner.query(`
        UPDATE \`workout\`
        SET \`body_parts\` = CASE
          WHEN \`body_part_minor\` IS NOT NULL
            THEN \`body_part_minor\`
          WHEN \`body_part_major\` IS NOT NULL
            THEN JSON_ARRAY(\`body_part_major\`)
          ELSE NULL
        END
      `);
    }

    if (await queryRunner.hasColumn('workout', 'equipment_original_detail')) {
      await queryRunner.query(`
        ALTER TABLE \`workout\`
        DROP COLUMN \`equipment_original_detail\`
      `);
    }
  }
}
