import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1775210000000 implements MigrationInterface {
    name = 'AutoMigration1775210000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`chat_history\` (\`id\` int NOT NULL AUTO_INCREMENT, \`input_text\` varchar(1000) NOT NULL, \`response_payload\` json NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`userId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`chat_history\` ADD CONSTRAINT \`FK_764e93dd7e8fc17e71abf6f9311\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`chat_history\` DROP FOREIGN KEY \`FK_764e93dd7e8fc17e71abf6f9311\``);
        await queryRunner.query(`DROP TABLE \`chat_history\``);
    }

}
