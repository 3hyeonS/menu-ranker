import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1775300000000 implements MigrationInterface {
    name = 'AutoMigration1775300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`profile_inquiry\` (\`id\` int NOT NULL AUTO_INCREMENT, \`content\` text NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`userId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`profile_inquiry\` ADD CONSTRAINT \`FK_fa17fa27854072d743e6ea9d8d3\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`profile_inquiry\` DROP FOREIGN KEY \`FK_fa17fa27854072d743e6ea9d8d3\``);
        await queryRunner.query(`DROP TABLE \`profile_inquiry\``);
    }

}
