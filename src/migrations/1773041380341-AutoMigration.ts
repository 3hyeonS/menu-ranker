import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773041380341 implements MigrationInterface {
    name = 'AutoMigration1773041380341'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_caaf7025e7a1ed8b92d648f51f\` ON \`kakao_key\``);
        await queryRunner.query(`DROP INDEX \`IDX_880bb8b0c26d959702cd31176d\` ON \`apple_key\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_880bb8b0c26d959702cd31176d\` ON \`apple_key\` (\`userId\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_caaf7025e7a1ed8b92d648f51f\` ON \`kakao_key\` (\`userId\`)`);
    }

}
