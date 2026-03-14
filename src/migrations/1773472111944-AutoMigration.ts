import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773472111944 implements MigrationInterface {
    name = 'AutoMigration1773472111944'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_info\` ADD \`userId\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`user_info\` ADD UNIQUE INDEX \`IDX_3a7fa0c3809d19eaf2fb4f6594\` (\`userId\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`REL_3a7fa0c3809d19eaf2fb4f6594\` ON \`user_info\` (\`userId\`)`);
        await queryRunner.query(`ALTER TABLE \`user_info\` ADD CONSTRAINT \`FK_3a7fa0c3809d19eaf2fb4f65949\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_info\` DROP FOREIGN KEY \`FK_3a7fa0c3809d19eaf2fb4f65949\``);
        await queryRunner.query(`DROP INDEX \`REL_3a7fa0c3809d19eaf2fb4f6594\` ON \`user_info\``);
        await queryRunner.query(`ALTER TABLE \`user_info\` DROP INDEX \`IDX_3a7fa0c3809d19eaf2fb4f6594\``);
        await queryRunner.query(`ALTER TABLE \`user_info\` DROP COLUMN \`userId\``);
    }

}
