import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMealTimestamps1780200000000 implements MigrationInterface {
  name = 'AddMealTimestamps1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `meal` ADD `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
    );
    await queryRunner.query(
      'ALTER TABLE `meal` ADD `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `meal` DROP COLUMN `updatedAt`');
    await queryRunner.query('ALTER TABLE `meal` DROP COLUMN `createdAt`');
  }
}
