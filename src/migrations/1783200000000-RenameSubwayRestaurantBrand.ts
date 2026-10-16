import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameSubwayRestaurantBrand1783200000000
  implements MigrationInterface
{
  name = 'RenameSubwayRestaurantBrand1783200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`restaurant\`
      SET \`name\` = '서브웨이', \`normalized_name\` = '서브웨이'
      WHERE \`name\` = '써브웨이'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`restaurant\`
      SET \`name\` = '써브웨이', \`normalized_name\` = '써브웨이'
      WHERE \`name\` = '서브웨이'
    `);
  }
}
