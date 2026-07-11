import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMealTime1780700000000 implements MigrationInterface {
  name = 'AddMealTime1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `meal` ADD `mealTime` varchar(5) NULL AFTER `time`',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `meal` DROP COLUMN `mealTime`');
  }
}
