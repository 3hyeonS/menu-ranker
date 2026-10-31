import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestaurantBranch1783800000000 implements MigrationInterface {
  name = 'AddRestaurantBranch1783800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`restaurant_branch\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`kakao_place_id\` varchar(20) NOT NULL,
        \`restaurant_id\` int NULL,
        \`place_name\` varchar(255) NOT NULL,
        \`address\` varchar(255) NULL,
        \`kakao_category\` varchar(255) NULL,
        \`match_source\` varchar(20) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY \`UQ_restaurant_branch_kakao_place_id\` (\`kakao_place_id\`),
        KEY \`IDX_restaurant_branch_restaurant\` (\`restaurant_id\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_restaurant_branch_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurant\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `restaurant_branch`');
  }
}
