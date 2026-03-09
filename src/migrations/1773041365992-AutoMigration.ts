import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773041365992 implements MigrationInterface {
    name = 'AutoMigration1773041365992'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`kakao_key\` DROP FOREIGN KEY \`FK_e59d34f98575e47808e1b1bd3fa\``);
        await queryRunner.query(`ALTER TABLE \`apple_key\` DROP FOREIGN KEY \`FK_b4f2383cb97f462b7bc8250780c\``);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP FOREIGN KEY \`FK_7008a2b0fb083127f60b5f4448e\``);
        await queryRunner.query(`DROP INDEX \`IDX_723583b54ef2a649247697739a\` ON \`kakao_key\``);
        await queryRunner.query(`DROP INDEX \`REL_e59d34f98575e47808e1b1bd3f\` ON \`kakao_key\``);
        await queryRunner.query(`DROP INDEX \`IDX_1497551164283e9ea9440f795a\` ON \`apple_key\``);
        await queryRunner.query(`DROP INDEX \`IDX_6576bb1a7423ca193cc0b8249d\` ON \`apple_key\``);
        await queryRunner.query(`DROP INDEX \`REL_b4f2383cb97f462b7bc8250780\` ON \`apple_key\``);
        await queryRunner.query(`DROP INDEX \`IDX_2d6c7b988637bf3b5cd34d9c87\` ON \`refresh_token\``);
        await queryRunner.query(`ALTER TABLE \`kakao_key\` ADD UNIQUE INDEX \`IDX_a8f1a17b3e173a59f848dd4f20\` (\`kakaoId\`)`);
        await queryRunner.query(`ALTER TABLE \`kakao_key\` ADD UNIQUE INDEX \`IDX_caaf7025e7a1ed8b92d648f51f\` (\`userId\`)`);
        await queryRunner.query(`ALTER TABLE \`apple_key\` ADD UNIQUE INDEX \`IDX_8d634f3829322974f3560ac36d\` (\`appleid\`)`);
        await queryRunner.query(`ALTER TABLE \`apple_key\` ADD UNIQUE INDEX \`IDX_5cd585fa38300f3938f62b5d9f\` (\`appleRefreshToken\`)`);
        await queryRunner.query(`ALTER TABLE \`apple_key\` ADD UNIQUE INDEX \`IDX_880bb8b0c26d959702cd31176d\` (\`userId\`)`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD UNIQUE INDEX \`IDX_c31d0a2f38e6e99110df62ab0a\` (\`token\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`REL_caaf7025e7a1ed8b92d648f51f\` ON \`kakao_key\` (\`userId\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`REL_880bb8b0c26d959702cd31176d\` ON \`apple_key\` (\`userId\`)`);
        await queryRunner.query(`ALTER TABLE \`kakao_key\` ADD CONSTRAINT \`FK_caaf7025e7a1ed8b92d648f51f9\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`apple_key\` ADD CONSTRAINT \`FK_880bb8b0c26d959702cd31176db\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_4f4a2f96c15ab6d200dbdf1e7f6\` FOREIGN KEY (\`signWithPlatform\`) REFERENCES \`sign_with\`(\`platform\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD CONSTRAINT \`FK_8e913e288156c133999341156ad\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP FOREIGN KEY \`FK_8e913e288156c133999341156ad\``);
        await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_4f4a2f96c15ab6d200dbdf1e7f6\``);
        await queryRunner.query(`ALTER TABLE \`apple_key\` DROP FOREIGN KEY \`FK_880bb8b0c26d959702cd31176db\``);
        await queryRunner.query(`ALTER TABLE \`kakao_key\` DROP FOREIGN KEY \`FK_caaf7025e7a1ed8b92d648f51f9\``);
        await queryRunner.query(`DROP INDEX \`REL_880bb8b0c26d959702cd31176d\` ON \`apple_key\``);
        await queryRunner.query(`DROP INDEX \`REL_caaf7025e7a1ed8b92d648f51f\` ON \`kakao_key\``);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` DROP INDEX \`IDX_c31d0a2f38e6e99110df62ab0a\``);
        await queryRunner.query(`ALTER TABLE \`apple_key\` DROP INDEX \`IDX_880bb8b0c26d959702cd31176d\``);
        await queryRunner.query(`ALTER TABLE \`apple_key\` DROP INDEX \`IDX_5cd585fa38300f3938f62b5d9f\``);
        await queryRunner.query(`ALTER TABLE \`apple_key\` DROP INDEX \`IDX_8d634f3829322974f3560ac36d\``);
        await queryRunner.query(`ALTER TABLE \`kakao_key\` DROP INDEX \`IDX_caaf7025e7a1ed8b92d648f51f\``);
        await queryRunner.query(`ALTER TABLE \`kakao_key\` DROP INDEX \`IDX_a8f1a17b3e173a59f848dd4f20\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_2d6c7b988637bf3b5cd34d9c87\` ON \`refresh_token\` (\`token\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`REL_b4f2383cb97f462b7bc8250780\` ON \`apple_key\` (\`userId\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_6576bb1a7423ca193cc0b8249d\` ON \`apple_key\` (\`appleid\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_1497551164283e9ea9440f795a\` ON \`apple_key\` (\`appleRefreshToken\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`REL_e59d34f98575e47808e1b1bd3f\` ON \`kakao_key\` (\`userId\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_723583b54ef2a649247697739a\` ON \`kakao_key\` (\`kakaoId\`)`);
        await queryRunner.query(`ALTER TABLE \`refresh_token\` ADD CONSTRAINT \`FK_7008a2b0fb083127f60b5f4448e\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`apple_key\` ADD CONSTRAINT \`FK_b4f2383cb97f462b7bc8250780c\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`kakao_key\` ADD CONSTRAINT \`FK_e59d34f98575e47808e1b1bd3fa\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
