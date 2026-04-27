import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoMigration1777804800000 implements MigrationInterface {
  name = 'AutoMigration1777804800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `menu` ADD `is_deleted` tinyint NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `menu` DROP COLUMN `is_deleted`');
  }
}
