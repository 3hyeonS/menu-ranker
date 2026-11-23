import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantBranchMenu1783900000000 implements MigrationInterface {
  name = 'AddRestaurantBranchMenu1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // UNIQUE(branch_id, sort_order)가 branch_id 조회와 FK 인덱스를 겸한다.
    await queryRunner.query(`
      CREATE TABLE \`restaurant_branch_menu\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`branch_id\` int NOT NULL,
        \`sort_order\` smallint NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`photo_url\` varchar(512) NULL,
        UNIQUE KEY \`UQ_restaurant_branch_menu_branch_order\` (\`branch_id\`, \`sort_order\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_restaurant_branch_menu_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`restaurant_branch\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `restaurant_branch_menu`');
  }
}
