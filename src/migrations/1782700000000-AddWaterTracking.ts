import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWaterTracking1782700000000 implements MigrationInterface {
  name = 'AddWaterTracking1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`water_intake\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`date\` date NOT NULL,
        \`amount_ml\` int NOT NULL,
        \`userId\` int NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY \`UQ_water_intake_user_date\` (\`userId\`, \`date\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_water_intake_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`water_setting\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`cup_size_ml\` int NOT NULL DEFAULT 100,
        \`userId\` int NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY \`UQ_water_setting_user\` (\`userId\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_water_setting_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `water_setting`');
    await queryRunner.query('DROP TABLE `water_intake`');
  }
}
