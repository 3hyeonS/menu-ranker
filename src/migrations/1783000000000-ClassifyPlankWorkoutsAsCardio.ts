import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClassifyPlankWorkoutsAsCardio1783000000000 implements MigrationInterface {
  name = 'ClassifyPlankWorkoutsAsCardio1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`workout\`
      SET
        \`workout_type\` = 'cardio',
        \`body_part_major\` = '유산소',
        \`body_part_minor\` = NULL
      WHERE \`name\` LIKE '%플랭크%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`workout\`
      SET
        \`workout_type\` = 'weight',
        \`body_part_major\` = '코어'
      WHERE \`name\` LIKE '%플랭크%'
    `);
  }
}
