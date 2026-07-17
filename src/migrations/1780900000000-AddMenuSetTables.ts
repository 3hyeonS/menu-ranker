import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMenuSetTables1780900000000 implements MigrationInterface {
  name = 'AddMenuSetTables1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`menu_set\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`userId\` int NOT NULL,
        INDEX \`IDX_menu_set_user_id_id\` (\`userId\`, \`id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`menu_set_menu\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`quantity\` float NOT NULL,
        \`menu_input_mode\` tinyint NOT NULL DEFAULT 0,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`menuSetId\` int NOT NULL,
        \`menuId\` int NOT NULL,
        INDEX \`IDX_menu_set_menu_set_order\` (\`menuSetId\`, \`sort_order\`),
        INDEX \`IDX_menu_set_menu_menu_id\` (\`menuId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`meal_set\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`mealId\` int NOT NULL,
        \`menuSetId\` int NOT NULL,
        INDEX \`IDX_meal_set_meal_order\` (\`mealId\`, \`sort_order\`),
        INDEX \`IDX_meal_set_set_id\` (\`menuSetId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE \`menu_set\`
      ADD CONSTRAINT \`FK_menu_set_user\`
      FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`menu_set_menu\`
      ADD CONSTRAINT \`FK_menu_set_menu_set\`
      FOREIGN KEY (\`menuSetId\`) REFERENCES \`menu_set\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`menu_set_menu\`
      ADD CONSTRAINT \`FK_menu_set_menu_menu\`
      FOREIGN KEY (\`menuId\`) REFERENCES \`menu\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`meal_set\`
      ADD CONSTRAINT \`FK_meal_set_meal\`
      FOREIGN KEY (\`mealId\`) REFERENCES \`meal\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`meal_set\`
      ADD CONSTRAINT \`FK_meal_set_menu_set\`
      FOREIGN KEY (\`menuSetId\`) REFERENCES \`menu_set\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `meal_set` DROP FOREIGN KEY `FK_meal_set_menu_set`',
    );
    await queryRunner.query(
      'ALTER TABLE `meal_set` DROP FOREIGN KEY `FK_meal_set_meal`',
    );
    await queryRunner.query(
      'ALTER TABLE `menu_set_menu` DROP FOREIGN KEY `FK_menu_set_menu_menu`',
    );
    await queryRunner.query(
      'ALTER TABLE `menu_set_menu` DROP FOREIGN KEY `FK_menu_set_menu_set`',
    );
    await queryRunner.query(
      'ALTER TABLE `menu_set` DROP FOREIGN KEY `FK_menu_set_user`',
    );
    await queryRunner.query('DROP TABLE `meal_set`');
    await queryRunner.query('DROP TABLE `menu_set_menu`');
    await queryRunner.query('DROP TABLE `menu_set`');
  }
}
