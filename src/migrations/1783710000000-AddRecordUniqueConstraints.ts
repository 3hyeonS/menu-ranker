import { MigrationInterface, QueryRunner } from 'typeorm';

// 같은 사용자·날짜(·끼니/운동)의 기록이 중복 저장되지 않게 UNIQUE 인덱스를 추가한다.
// 운영 DB 중복 0건 확인(2026-10-25, #7 결정). 실행은 사용자 허락 후에만 한다.
export class AddRecordUniqueConstraints1783710000000 implements MigrationInterface {
  name = 'AddRecordUniqueConstraints1783710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `meal` ADD UNIQUE INDEX `UQ_meal_user_date_time` (`userId`, `date`, `time`)',
    );
    await queryRunner.query(
      'ALTER TABLE `weight_steps` ADD UNIQUE INDEX `UQ_weight_steps_user_date` (`userId`, `date`)',
    );

    // workout_record는 1781000000000-AddWorkoutTables에서 같은 UNIQUE 인덱스를 만들었다.
    // 그 마이그레이션 없이 만들어진 DB에만 추가한다.
    if (
      !(await this.hasIndex(
        queryRunner,
        'workout_record',
        'IDX_workout_record_user_date_workout',
      ))
    ) {
      await queryRunner.query(
        'ALTER TABLE `workout_record` ADD UNIQUE INDEX `IDX_workout_record_user_date_workout` (`userId`, `date`, `workoutId`)',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // MySQL은 userId로 시작하는 UNIQUE 인덱스가 생기면 FK용 자동 인덱스를 지울 수 있다.
    // FK(userId)가 쓸 인덱스를 먼저 만든 뒤 UNIQUE 인덱스를 지운다.
    await queryRunner.query(
      'ALTER TABLE `weight_steps` ADD INDEX `IDX_weight_steps_user` (`userId`), DROP INDEX `UQ_weight_steps_user_date`',
    );
    await queryRunner.query(
      'ALTER TABLE `meal` ADD INDEX `IDX_meal_user` (`userId`), DROP INDEX `UQ_meal_user_date_time`',
    );
    // workout_record 인덱스는 1781000000000-AddWorkoutTables 소유라 지우지 않는다.
  }

  private async hasIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<boolean> {
    const rows: Array<{ count: string | number }> = await queryRunner.query(
      `
        SELECT COUNT(*) AS \`count\`
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND index_name = ?
      `,
      [tableName, indexName],
    );

    return Number(rows[0]?.count ?? 0) > 0;
  }
}
