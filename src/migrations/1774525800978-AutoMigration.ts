import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1774525800978 implements MigrationInterface {
    name = 'AutoMigration1774525800978'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`weight_steps\` (\`id\` int NOT NULL AUTO_INCREMENT, \`date\` datetime NOT NULL, \`weight\` float NULL, \`steps\` float NULL, \`userId\` int NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`weight_steps\` ADD CONSTRAINT \`FK_8d10811638d6d482e6dbbc2ac69\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`weight_steps\` DROP FOREIGN KEY \`FK_8d10811638d6d482e6dbbc2ac69\``);
        await queryRunner.query(`DROP TABLE \`weight_steps\``);
    }

}
