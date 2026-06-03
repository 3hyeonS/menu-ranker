import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserInfoOnboardingFields1780300000000
  implements MigrationInterface
{
  name = 'AddUserInfoOnboardingFields1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user_info` ADD `diet_management_status` json NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `user_info` ADD `persona_type` int NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `user_info` ADD `eating_out_freq_weekly` int NULL',
    );
    await queryRunner.query('ALTER TABLE `user_info` ADD `job_type` int NULL');
    await queryRunner.query(
      'ALTER TABLE `user_info` ADD `lunch_location` int NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user_info` DROP COLUMN `lunch_location`',
    );
    await queryRunner.query('ALTER TABLE `user_info` DROP COLUMN `job_type`');
    await queryRunner.query(
      'ALTER TABLE `user_info` DROP COLUMN `eating_out_freq_weekly`',
    );
    await queryRunner.query(
      'ALTER TABLE `user_info` DROP COLUMN `persona_type`',
    );
    await queryRunner.query(
      'ALTER TABLE `user_info` DROP COLUMN `diet_management_status`',
    );
  }
}
