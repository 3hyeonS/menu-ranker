import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoMigration1777276800000 implements MigrationInterface {
  name = 'AutoMigration1777276800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `meal_menu` ADD `menu_input_mode` tinyint NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `meal_menu` DROP COLUMN `menu_input_mode`',
    );
  }
}
