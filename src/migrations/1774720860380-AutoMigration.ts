import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1774720860380 implements MigrationInterface {
    name = 'AutoMigration1774720860380'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`meal_menu\` DROP COLUMN \`quantity\``);
        await queryRunner.query(`ALTER TABLE \`meal_menu\` ADD \`quantity\` float NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`meal_menu\` DROP COLUMN \`quantity\``);
        await queryRunner.query(`ALTER TABLE \`meal_menu\` ADD \`quantity\` int NOT NULL`);
    }

}
