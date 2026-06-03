import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInquiryClientInfo1780400000000 implements MigrationInterface {
  name = 'AddInquiryClientInfo1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `inquiry` ADD `app_version` varchar(50) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `inquiry` ADD `os_name` varchar(50) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `inquiry` ADD `os_version` varchar(50) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `inquiry` DROP COLUMN `os_version`');
    await queryRunner.query('ALTER TABLE `inquiry` DROP COLUMN `os_name`');
    await queryRunner.query('ALTER TABLE `inquiry` DROP COLUMN `app_version`');
  }
}
