import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantMenuNutritionEstimate1784000000000 implements MigrationInterface {
  name = 'AddRestaurantMenuNutritionEstimate1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 정규화 메뉴명 단위 영양 추정값(#41). 지점 메뉴와는 FK 없이 normalized_name으로 잇는다.
    await queryRunner.query(`
      CREATE TABLE \`restaurant_menu_nutrition_estimate\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`normalized_name\` varchar(255) NOT NULL,
        \`sample_name\` varchar(255) NOT NULL,
        \`source\` varchar(10) NOT NULL,
        \`calories\` decimal(12,3) NULL,
        \`carbs\` decimal(12,3) NULL,
        \`protein\` decimal(12,3) NULL,
        \`fat\` decimal(12,3) NULL,
        \`sugars\` decimal(12,3) NULL,
        \`sat_fat\` decimal(12,3) NULL,
        \`unit\` tinyint NOT NULL DEFAULT 0,
        \`weight\` decimal(12,3) NULL,
        \`unit_quantity\` varchar(50) NOT NULL,
        \`confidence\` decimal(4,3) NULL,
        \`estimate_path\` varchar(20) NULL,
        \`rag_confidence\` decimal(4,3) NULL,
        \`model\` varchar(100) NULL,
        \`prompt_version\` varchar(50) NULL,
        \`reference_menus\` json NULL,
        \`input_tokens\` int NULL,
        \`output_tokens\` int NULL,
        \`estimated_at\` datetime(6) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY \`UQ_restaurant_menu_nutrition_estimate_name\` (\`normalized_name\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `restaurant_menu_nutrition_estimate`');
  }
}
