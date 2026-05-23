import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionCodeTables1780100000000 implements MigrationInterface {
  name = 'AddSubscriptionCodeTables1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user_info` DROP INDEX `IDX_049093dd836df91197aa914044`',
    );
    await queryRunner.query(
      "CREATE TABLE `subscription_code` (`id` int NOT NULL AUTO_INCREMENT, `code` varchar(255) NOT NULL, `type` varchar(255) NOT NULL DEFAULT 'PROMOTION', `status` varchar(255) NOT NULL DEFAULT 'ACTIVE', `max_uses` int NOT NULL DEFAULT '1', `used_count` int NOT NULL DEFAULT '0', `starts_at` datetime NULL, `expires_at` datetime NULL, `benefit_days` int NOT NULL DEFAULT '30', `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `IDX_subscription_code_code` (`code`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      "CREATE TABLE `user_subscription` (`id` int NOT NULL AUTO_INCREMENT, `status` varchar(255) NOT NULL DEFAULT 'ACTIVE', `starts_at` datetime NOT NULL, `expires_at` datetime NOT NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `userId` int NOT NULL, `subscriptionCodeId` int NOT NULL, UNIQUE INDEX `IDX_user_subscription_user_code` (`userId`, `subscriptionCodeId`), INDEX `IDX_user_subscription_user_status_expires` (`userId`, `status`, `expires_at`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'ALTER TABLE `user_subscription` ADD CONSTRAINT `FK_user_subscription_user` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE `user_subscription` ADD CONSTRAINT `FK_user_subscription_code` FOREIGN KEY (`subscriptionCodeId`) REFERENCES `subscription_code`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `user_subscription` DROP FOREIGN KEY `FK_user_subscription_code`',
    );
    await queryRunner.query(
      'ALTER TABLE `user_subscription` DROP FOREIGN KEY `FK_user_subscription_user`',
    );
    await queryRunner.query(
      'DROP INDEX `IDX_user_subscription_user_status_expires` ON `user_subscription`',
    );
    await queryRunner.query(
      'DROP INDEX `IDX_user_subscription_user_code` ON `user_subscription`',
    );
    await queryRunner.query('DROP TABLE `user_subscription`');
    await queryRunner.query(
      'DROP INDEX `IDX_subscription_code_code` ON `subscription_code`',
    );
    await queryRunner.query('DROP TABLE `subscription_code`');
    await queryRunner.query(
      'ALTER TABLE `user_info` ADD UNIQUE INDEX `IDX_049093dd836df91197aa914044` (`subCode`)',
    );
  }
}
