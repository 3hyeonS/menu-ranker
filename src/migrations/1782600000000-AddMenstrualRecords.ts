import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMenstrualRecords1782600000000 implements MigrationInterface {
  name = 'AddMenstrualRecords1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`menstrual_cycle\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`start_date\` date NOT NULL,
        \`end_date\` date NOT NULL,
        \`is_end\` tinyint NOT NULL DEFAULT 0,
        \`userId\` int NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_menstrual_cycle_user_start\` (\`userId\`, \`start_date\`),
        CONSTRAINT \`FK_menstrual_cycle_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`menstrual_record\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`date\` date NOT NULL,
        \`menstruation_status\` varchar(10) NOT NULL,
        \`flow\` varchar(20) NULL,
        \`symptoms\` json NULL,
        \`cycleId\` int NOT NULL,
        \`userId\` int NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_menstrual_record_user_date\` (\`userId\`, \`date\`),
        KEY \`IDX_menstrual_record_cycle_date\` (\`cycleId\`, \`date\`),
        CONSTRAINT \`FK_menstrual_record_cycle\` FOREIGN KEY (\`cycleId\`) REFERENCES \`menstrual_cycle\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`FK_menstrual_record_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `menstrual_record`');
    await queryRunner.query('DROP TABLE `menstrual_cycle`');
  }
}
