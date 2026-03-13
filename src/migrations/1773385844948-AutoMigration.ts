import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773385844948 implements MigrationInterface {
    name = 'AutoMigration1773385844948'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`user_info\` (\`id\` int NOT NULL AUTO_INCREMENT, \`gender\` tinyint NOT NULL, \`birthYear\` int NOT NULL, \`height\` float NOT NULL, \`weight\` float NOT NULL, \`activity\` tinyint NOT NULL, \`goal\` tinyint NOT NULL, \`target_weight\` float NOT NULL, \`target_calories\` int NOT NULL, \`target_ratio\` json NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP COLUMN \`gender\``);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD \`token\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD UNIQUE INDEX \`IDX_c31d0a2f38e6e99110df62ab0a\` (\`token\`)`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD \`expiresAt\` datetime NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD \`userId\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD CONSTRAINT \`FK_8e913e288156c133999341156ad\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP FOREIGN KEY \`FK_8e913e288156c133999341156ad\``);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP COLUMN \`userId\``);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP COLUMN \`expiresAt\``);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP COLUMN \`createdAt\``);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP INDEX \`IDX_c31d0a2f38e6e99110df62ab0a\``);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP COLUMN \`token\``);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD \`gender\` tinyint NOT NULL`);
        await queryRunner.query(`DROP TABLE \`user_info\``);
    }

}
