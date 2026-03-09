import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773042993394 implements MigrationInterface {
    name = 'AutoMigration1773042993394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`sign_with\` (\`platform\` varchar(255) NOT NULL, PRIMARY KEY (\`platform\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`kakao_key\` (\`id\` int NOT NULL AUTO_INCREMENT, \`kakaoId\` varchar(255) NOT NULL, \`userId\` int NOT NULL, UNIQUE INDEX \`IDX_a8f1a17b3e173a59f848dd4f20\` (\`kakaoId\`), UNIQUE INDEX \`REL_caaf7025e7a1ed8b92d648f51f\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`apple_key\` (\`id\` int NOT NULL AUTO_INCREMENT, \`appleid\` varchar(255) NOT NULL, \`appleRefreshToken\` varchar(255) NOT NULL, \`userId\` int NOT NULL, UNIQUE INDEX \`IDX_8d634f3829322974f3560ac36d\` (\`appleid\`), UNIQUE INDEX \`IDX_5cd585fa38300f3938f62b5d9f\` (\`appleRefreshToken\`), UNIQUE INDEX \`REL_880bb8b0c26d959702cd31176d\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`authority\` (\`role\` varchar(255) NOT NULL, PRIMARY KEY (\`role\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user\` (\`id\` int NOT NULL AUTO_INCREMENT, \`nickname\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`signWithPlatform\` varchar(255) NOT NULL, \`authorityRole\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`refresh_token\` (\`id\` int NOT NULL AUTO_INCREMENT, \`token\` varchar(255) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`expiresAt\` datetime NOT NULL, \`userId\` int NULL, UNIQUE INDEX \`IDX_c31d0a2f38e6e99110df62ab0a\` (\`token\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`kakao_key\` ADD CONSTRAINT \`FK_caaf7025e7a1ed8b92d648f51f9\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`apple_key\` ADD CONSTRAINT \`FK_880bb8b0c26d959702cd31176db\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_4f4a2f96c15ab6d200dbdf1e7f6\` FOREIGN KEY (\`signWithPlatform\`) REFERENCES \`sign_with\`(\`platform\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_26e70e189a08c6cb4cd0afbb6bb\` FOREIGN KEY (\`authorityRole\`) REFERENCES \`authority\`(\`role\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD CONSTRAINT \`FK_8e913e288156c133999341156ad\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP FOREIGN KEY \`FK_8e913e288156c133999341156ad\``);
        await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_26e70e189a08c6cb4cd0afbb6bb\``);
        await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_4f4a2f96c15ab6d200dbdf1e7f6\``);
        await queryRunner.query(`ALTER TABLE \`apple_key\` DROP FOREIGN KEY \`FK_880bb8b0c26d959702cd31176db\``);
        await queryRunner.query(`ALTER TABLE \`kakao_key\` DROP FOREIGN KEY \`FK_caaf7025e7a1ed8b92d648f51f9\``);
        await queryRunner.query(`DROP INDEX \`IDX_c31d0a2f38e6e99110df62ab0a\` ON \`refresh_token\``);
        await queryRunner.query(`DROP TABLE \`refresh_token\``);
        await queryRunner.query(`DROP TABLE \`user\``);
        await queryRunner.query(`DROP TABLE \`authority\``);
        await queryRunner.query(`DROP INDEX \`REL_880bb8b0c26d959702cd31176d\` ON \`apple_key\``);
        await queryRunner.query(`DROP INDEX \`IDX_5cd585fa38300f3938f62b5d9f\` ON \`apple_key\``);
        await queryRunner.query(`DROP INDEX \`IDX_8d634f3829322974f3560ac36d\` ON \`apple_key\``);
        await queryRunner.query(`DROP TABLE \`apple_key\``);
        await queryRunner.query(`DROP INDEX \`REL_caaf7025e7a1ed8b92d648f51f\` ON \`kakao_key\``);
        await queryRunner.query(`DROP INDEX \`IDX_a8f1a17b3e173a59f848dd4f20\` ON \`kakao_key\``);
        await queryRunner.query(`DROP TABLE \`kakao_key\``);
        await queryRunner.query(`DROP TABLE \`sign_with\``);
    }

}
