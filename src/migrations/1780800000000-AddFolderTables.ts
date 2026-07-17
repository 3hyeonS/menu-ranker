import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFolderTables1780800000000 implements MigrationInterface {
  name = 'AddFolderTables1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`folder\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`userId\` int NOT NULL,
        INDEX \`IDX_folder_user_id_id\` (\`userId\`, \`id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`folder_menu\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`quantity\` float NOT NULL,
        \`menu_input_mode\` tinyint NOT NULL DEFAULT 0,
        \`sort_order\` int NOT NULL DEFAULT 0,
        \`folderId\` int NOT NULL,
        \`menuId\` int NOT NULL,
        INDEX \`IDX_folder_menu_folder_order\` (\`folderId\`, \`sort_order\`),
        INDEX \`IDX_folder_menu_menu_id\` (\`menuId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE \`folder\`
      ADD CONSTRAINT \`FK_folder_user\`
      FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`folder_menu\`
      ADD CONSTRAINT \`FK_folder_menu_folder\`
      FOREIGN KEY (\`folderId\`) REFERENCES \`folder\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`folder_menu\`
      ADD CONSTRAINT \`FK_folder_menu_menu\`
      FOREIGN KEY (\`menuId\`) REFERENCES \`menu\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `folder_menu` DROP FOREIGN KEY `FK_folder_menu_menu`',
    );
    await queryRunner.query(
      'ALTER TABLE `folder_menu` DROP FOREIGN KEY `FK_folder_menu_folder`',
    );
    await queryRunner.query(
      'ALTER TABLE `folder` DROP FOREIGN KEY `FK_folder_user`',
    );
    await queryRunner.query('DROP TABLE `folder_menu`');
    await queryRunner.query('DROP TABLE `folder`');
  }
}
