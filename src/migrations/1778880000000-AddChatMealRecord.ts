import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatMealRecord1778880000000 implements MigrationInterface {
  name = 'AddChatMealRecord1778880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `chat_history` ADD `meal_record` json NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `chat_history` DROP COLUMN `meal_record`',
    );
  }
}
