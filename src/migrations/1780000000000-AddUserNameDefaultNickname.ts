import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNameDefaultNickname1780000000000
  implements MigrationInterface
{
  name = 'AddUserNameDefaultNickname1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user` ADD `name` varchar(255) NULL AFTER `nickname`',
    );
    await queryRunner.query(
      'UPDATE `user` SET `name` = `nickname` WHERE `name` IS NULL',
    );
    await queryRunner.query(
      "UPDATE `user` SET `nickname` = CONCAT('멜로유저', `id`) WHERE `nickname` IS NULL OR `nickname` = ''",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `user` DROP COLUMN `name`');
  }
}
