import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773473873716 implements MigrationInterface {
    name = 'AutoMigration1773473873716'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_info\` ADD \`subCode\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`user_info\` ADD UNIQUE INDEX \`IDX_049093dd836df91197aa914044\` (\`subCode\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_info\` DROP INDEX \`IDX_049093dd836df91197aa914044\``);
        await queryRunner.query(`ALTER TABLE \`user_info\` DROP COLUMN \`subCode\``);
    }

}
