import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillWorkoutMachineDetails1781210000000
  implements MigrationInterface
{
  name = 'BackfillWorkoutMachineDetails1781210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`workout\`
      SET \`equipment_detail\` = \`equipments\`
      WHERE \`equipment_category\` = '머신'
        AND \`equipments\` IS NOT NULL
        AND TRIM(\`equipments\`) <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`workout\`
      SET \`equipment_detail\` = NULL
      WHERE \`equipment_category\` = '머신'
    `);
  }
}
