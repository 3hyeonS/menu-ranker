import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameAuthTablesToSnakeCase1773044900000
  implements MigrationInterface
{
  name = 'RenameAuthTablesToSnakeCase1773044900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'RENAME TABLE `signWith` TO `sign_with`, `kakaoKey` TO `kakao_key`, `appleKey` TO `apple_key`, `refreshToken` TO `refresh_token`',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'RENAME TABLE `sign_with` TO `signWith`, `kakao_key` TO `kakaoKey`, `apple_key` TO `appleKey`, `refresh_token` TO `refreshToken`',
    );
  }
}
