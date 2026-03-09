import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773039964521 implements MigrationInterface {
    name = 'AutoMigration1773039964521'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`signWith\` (\`platform\` varchar(255) NOT NULL, PRIMARY KEY (\`platform\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`kakaoKey\` (\`id\` int NOT NULL AUTO_INCREMENT, \`kakaoId\` varchar(255) NOT NULL, \`userId\` int NOT NULL, UNIQUE INDEX \`IDX_723583b54ef2a649247697739a\` (\`kakaoId\`), UNIQUE INDEX \`REL_e59d34f98575e47808e1b1bd3f\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`appleKey\` (\`id\` int NOT NULL AUTO_INCREMENT, \`appleid\` varchar(255) NOT NULL, \`appleRefreshToken\` varchar(255) NOT NULL, \`userId\` int NOT NULL, UNIQUE INDEX \`IDX_6576bb1a7423ca193cc0b8249d\` (\`appleid\`), UNIQUE INDEX \`IDX_1497551164283e9ea9440f795a\` (\`appleRefreshToken\`), UNIQUE INDEX \`REL_b4f2383cb97f462b7bc8250780\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`authority\` (\`role\` varchar(255) NOT NULL, PRIMARY KEY (\`role\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user\` (\`id\` int NOT NULL AUTO_INCREMENT, \`nickname\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`signWithPlatform\` varchar(255) NOT NULL, \`authorityRole\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`refreshToken\` (\`id\` int NOT NULL AUTO_INCREMENT, \`token\` varchar(255) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`expiresAt\` datetime NOT NULL, \`userId\` int NULL, UNIQUE INDEX \`IDX_2d6c7b988637bf3b5cd34d9c87\` (\`token\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`kakaoKey\` ADD CONSTRAINT \`FK_e59d34f98575e47808e1b1bd3fa\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`appleKey\` ADD CONSTRAINT \`FK_b4f2383cb97f462b7bc8250780c\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_4f4a2f96c15ab6d200dbdf1e7f6\` FOREIGN KEY (\`signWithPlatform\`) REFERENCES \`signWith\`(\`platform\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_26e70e189a08c6cb4cd0afbb6bb\` FOREIGN KEY (\`authorityRole\`) REFERENCES \`authority\`(\`role\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`refreshToken\` ADD CONSTRAINT \`FK_7008a2b0fb083127f60b5f4448e\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`refreshToken\` DROP FOREIGN KEY \`FK_7008a2b0fb083127f60b5f4448e\``);
        await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_26e70e189a08c6cb4cd0afbb6bb\``);
        await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_4f4a2f96c15ab6d200dbdf1e7f6\``);
        await queryRunner.query(`ALTER TABLE \`appleKey\` DROP FOREIGN KEY \`FK_b4f2383cb97f462b7bc8250780c\``);
        await queryRunner.query(`ALTER TABLE \`kakaoKey\` DROP FOREIGN KEY \`FK_e59d34f98575e47808e1b1bd3fa\``);
        await queryRunner.query(`DROP INDEX \`IDX_2d6c7b988637bf3b5cd34d9c87\` ON \`refreshToken\``);
        await queryRunner.query(`DROP TABLE \`refreshToken\``);
        await queryRunner.query(`DROP TABLE \`user\``);
        await queryRunner.query(`DROP TABLE \`authority\``);
        await queryRunner.query(`DROP INDEX \`REL_b4f2383cb97f462b7bc8250780\` ON \`appleKey\``);
        await queryRunner.query(`DROP INDEX \`IDX_1497551164283e9ea9440f795a\` ON \`appleKey\``);
        await queryRunner.query(`DROP INDEX \`IDX_6576bb1a7423ca193cc0b8249d\` ON \`appleKey\``);
        await queryRunner.query(`DROP TABLE \`appleKey\``);
        await queryRunner.query(`DROP INDEX \`REL_e59d34f98575e47808e1b1bd3f\` ON \`kakaoKey\``);
        await queryRunner.query(`DROP INDEX \`IDX_723583b54ef2a649247697739a\` ON \`kakaoKey\``);
        await queryRunner.query(`DROP TABLE \`kakaoKey\``);
        await queryRunner.query(`DROP TABLE \`signWith\``);
    }

}
