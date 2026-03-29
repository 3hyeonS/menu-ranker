import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1774783579436 implements MigrationInterface {
    name = 'AutoMigration1774783579436'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`brand_add\` (\`id\` int NOT NULL AUTO_INCREMENT, \`brand\` varchar(255) NOT NULL, \`userId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`brand_add\` ADD CONSTRAINT \`FK_c1b1cf569f7e6b7c1d8e850aab4\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`brand_add\` DROP FOREIGN KEY \`FK_c1b1cf569f7e6b7c1d8e850aab4\``);
        await queryRunner.query(`DROP TABLE \`brand_add\``);
    }

}
