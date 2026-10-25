import { MigrationInterface, QueryRunner } from 'typeorm';

// refresh token payload에 jti가 추가되어 길어진 토큰이 varchar(255)를 넘지 않도록 컬럼을 넓힌다.
export class WidenRefreshTokenColumn1783710000000 implements MigrationInterface {
  name = 'WidenRefreshTokenColumn1783710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_token\` MODIFY \`token\` varchar(512) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_token\` MODIFY \`token\` varchar(255) NOT NULL`,
    );
  }
}
