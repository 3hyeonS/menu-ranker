import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1774442557536 implements MigrationInterface {
    name = 'AutoMigration1774442557536'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`meal_menu\` (\`id\` int NOT NULL AUTO_INCREMENT, \`quantity\` int NOT NULL, \`mealId\` int NOT NULL, \`menuId\` int NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`meal\` (\`id\` int NOT NULL AUTO_INCREMENT, \`date\` datetime NOT NULL, \`time\` tinyint NOT NULL, \`image\` varchar(255) NULL, \`userId\` int NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`menu\` (\`id\` int NOT NULL AUTO_INCREMENT, \`data_source\` tinyint NOT NULL, \`name\` varchar(255) NOT NULL, \`brand\` varchar(255) NULL, \`category\` varchar(255) NULL, \`unit\` tinyint NOT NULL, \`weight\` float NOT NULL, \`unit_quantity\` varchar(255) NOT NULL, \`calories\` float NOT NULL, \`carbs\` float NULL, \`sugars\` float NULL, \`sugar_alchol\` float NULL, \`dietary_fiber\` float NULL, \`protein\` float NULL, \`fat\` float NULL, \`sat_fat\` float NULL, \`trans_fat\` float NULL, \`un_sat_fat\` float NULL, \`sodium\` float NULL, \`caffeine\` float NULL, \`potassium\` float NULL, \`cholesterol\` float NULL, \`alcohol\` float NULL, \`userId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`meal_menu\` ADD CONSTRAINT \`FK_8420b97b45213264fea278e86b6\` FOREIGN KEY (\`mealId\`) REFERENCES \`meal\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`meal_menu\` ADD CONSTRAINT \`FK_8429b3b6302ab4b368205fcb3d8\` FOREIGN KEY (\`menuId\`) REFERENCES \`menu\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`meal\` ADD CONSTRAINT \`FK_419ad998c5e3b37a7cce0f872f5\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`menu\` ADD CONSTRAINT \`FK_4567d47472c13f6d5145c0443a2\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`menu\` DROP FOREIGN KEY \`FK_4567d47472c13f6d5145c0443a2\``);
        await queryRunner.query(`ALTER TABLE \`meal\` DROP FOREIGN KEY \`FK_419ad998c5e3b37a7cce0f872f5\``);
        await queryRunner.query(`ALTER TABLE \`meal_menu\` DROP FOREIGN KEY \`FK_8429b3b6302ab4b368205fcb3d8\``);
        await queryRunner.query(`ALTER TABLE \`meal_menu\` DROP FOREIGN KEY \`FK_8420b97b45213264fea278e86b6\``);
        await queryRunner.query(`DROP TABLE \`menu\``);
        await queryRunner.query(`DROP TABLE \`meal\``);
        await queryRunner.query(`DROP TABLE \`meal_menu\``);
    }

}
