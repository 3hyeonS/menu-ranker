import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1775804247871 implements MigrationInterface {
    name = 'AutoMigration1775804247871'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`chat_history\` DROP FOREIGN KEY \`FK_764e93dd7e8fc17e71abf6f9311\``);
        await queryRunner.query(`CREATE TABLE \`user_goal\` (\`id\` int NOT NULL AUTO_INCREMENT, \`activity\` tinyint NOT NULL, \`goal\` tinyint NOT NULL, \`target_weight\` float NOT NULL, \`target_calories\` int NOT NULL, \`target_ratio\` json NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`userId\` int NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`inquiry\` (\`id\` int NOT NULL AUTO_INCREMENT, \`content\` text NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`userId\` int NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`chat_history\` CHANGE \`userId\` \`userId\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`chat_history\` ADD CONSTRAINT \`FK_6bac64204c7b416f465e17957ed\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`user_goal\` ADD CONSTRAINT \`FK_7c3b2323b52a353a984754e5c41\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`inquiry\` ADD CONSTRAINT \`FK_7806c6fea3e0ff475bb422ba0c0\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inquiry\` DROP FOREIGN KEY \`FK_7806c6fea3e0ff475bb422ba0c0\``);
        await queryRunner.query(`ALTER TABLE \`user_goal\` DROP FOREIGN KEY \`FK_7c3b2323b52a353a984754e5c41\``);
        await queryRunner.query(`ALTER TABLE \`chat_history\` DROP FOREIGN KEY \`FK_6bac64204c7b416f465e17957ed\``);
        await queryRunner.query(`ALTER TABLE \`chat_history\` CHANGE \`userId\` \`userId\` int NULL`);
        await queryRunner.query(`DROP TABLE \`inquiry\``);
        await queryRunner.query(`DROP TABLE \`user_goal\``);
        await queryRunner.query(`ALTER TABLE \`chat_history\` ADD CONSTRAINT \`FK_764e93dd7e8fc17e71abf6f9311\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
