import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkoutMet1781100000000 implements MigrationInterface {
  name = 'AddWorkoutMet1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`workout\`
      ADD \`met\` float NULL
    `);

    await queryRunner.query(`
      UPDATE \`workout\`
      SET \`met\` = CASE
        WHEN LOWER(\`name\`) REGEXP '스트레칭|스트레치|요가|포즈|자세|코브라|차일드|업워드|다운워드|가동성|모빌리티|폼롤|롤러|마사지|워밍업|쿨다운'
          THEN 2.5
        WHEN \`equipments\` REGEXP '덤벨|바벨|케이블|머신|스미스|슬레드|중량|케틀벨|EZ 바벨|trap bar|olympic barbell|hammer|tire'
          THEN 5.0
        WHEN \`equipments\` REGEXP '맨몸|밴드|저항 밴드|메디신볼|짐볼|보수볼|로프|휠 롤러|일립티컬|skierg|stationary bike|stepmill|upper body ergometer'
          THEN 3.5
        WHEN \`workout_type\` = 'weight'
          THEN 5.0
        ELSE 3.5
      END
      WHERE \`met\` IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`workout\`
      DROP COLUMN \`met\`
    `);
  }
}
