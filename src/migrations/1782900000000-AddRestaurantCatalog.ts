import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantCatalog1782900000000 implements MigrationInterface {
  name = 'AddRestaurantCatalog1782900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`restaurant\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`normalized_name\` varchar(255) NOT NULL,
        \`category\` varchar(50) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY \`UQ_restaurant_name\` (\`name\`),
        KEY \`IDX_restaurant_normalized_name\` (\`normalized_name\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`restaurant_menu\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`restaurant_id\` int NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`menu_category\` varchar(100) NULL,
        \`unit\` tinyint NOT NULL,
        \`weight\` decimal(12,3) NOT NULL,
        \`unit_quantity\` varchar(50) NOT NULL,
        \`calories\` decimal(12,3) NOT NULL,
        \`carbs\` decimal(12,3) NULL,
        \`sugars\` decimal(12,3) NULL,
        \`sugar_alcohol\` decimal(12,3) NULL,
        \`dietary_fiber\` decimal(12,3) NULL,
        \`protein\` decimal(12,3) NULL,
        \`fat\` decimal(12,3) NULL,
        \`sat_fat\` decimal(12,3) NULL,
        \`trans_fat\` decimal(12,3) NULL,
        \`unsat_fat\` decimal(12,3) NULL,
        \`sodium\` decimal(12,3) NULL,
        \`caffeine\` decimal(12,3) NULL,
        \`potassium\` decimal(12,3) NULL,
        \`cholesterol\` decimal(12,3) NULL,
        \`alcohol\` decimal(12,3) NULL,
        \`source_key\` char(64) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY \`UQ_restaurant_menu_source_key\` (\`source_key\`),
        KEY \`IDX_restaurant_menu_restaurant\` (\`restaurant_id\`),
        KEY \`IDX_restaurant_menu_category\` (\`menu_category\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_restaurant_menu_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurant\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `restaurant_menu`');
    await queryRunner.query('DROP TABLE `restaurant`');
  }
}
