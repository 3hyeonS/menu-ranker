import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkoutClassifications1781200000000
  implements MigrationInterface
{
  name = 'AddWorkoutClassifications1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`workout\`
      ADD \`body_part_major\` varchar(20) NULL,
      ADD \`body_part_minor\` text NULL,
      ADD \`equipment_category\` varchar(30) NULL,
      ADD \`equipment_detail\` varchar(255) NULL
    `);

    await queryRunner.query(`
      UPDATE \`workout\`
      SET \`equipments\` = CASE LOWER(REPLACE(REPLACE(REPLACE(\`equipments\`, ' ', ''), '_', ''), '-', ''))
        WHEN 'ez바벨' THEN '이지 바벨'
        WHEN 'olympicbarbell' THEN '올림픽 바벨'
        WHEN 'trapbar' THEN '트랩 바벨'
        WHEN 'hammer' THEN '해머'
        WHEN 'skiergmachine' THEN '스키에르그 머신'
        WHEN 'stationarybike' THEN '고정식 자전거'
        WHEN 'stepmillmachine' THEN '스텝밀 머신'
        WHEN 'tire' THEN '타이어'
        WHEN 'upperbodyergometer' THEN '상체 에르고미터'
        WHEN '케이블' THEN '케이블 머신'
        WHEN '저항밴드' THEN '밴드'
        WHEN '롤러' THEN '폼롤러'
        WHEN '휠롤러' THEN '폼롤러'
        ELSE \`equipments\`
      END
      WHERE \`equipments\` IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE \`workout\`
      SET
        \`body_part_major\` = CASE
          WHEN \`workout_type\` = 'cardio' THEN '유산소'
          WHEN \`body_parts\` LIKE '%허벅지%' OR \`body_parts\` LIKE '%종아리%' THEN '하체'
          WHEN \`body_parts\` LIKE '%상완%' OR \`body_parts\` LIKE '%전완%' THEN '팔'
          WHEN \`body_parts\` LIKE '%복부%' OR \`body_parts\` LIKE '%허리%' OR \`body_parts\` LIKE '%목%' THEN '코어'
          WHEN \`body_parts\` LIKE '%가슴%' THEN '가슴'
          WHEN \`body_parts\` LIKE '%등%' THEN '등'
          WHEN \`body_parts\` LIKE '%어깨%' THEN '어깨'
          ELSE '코어'
        END,
        \`body_part_minor\` = CASE
          WHEN \`workout_type\` = 'cardio' THEN NULL
          WHEN \`body_parts\` LIKE '%허벅지%' THEN JSON_ARRAY('허벅지')
          WHEN \`body_parts\` LIKE '%종아리%' THEN JSON_ARRAY('종아리')
          WHEN \`body_parts\` LIKE '%상완%' THEN JSON_ARRAY('상완')
          WHEN \`body_parts\` LIKE '%전완%' THEN JSON_ARRAY('전완')
          WHEN \`body_parts\` LIKE '%복부%' THEN JSON_ARRAY('복부')
          WHEN \`body_parts\` LIKE '%허리%' THEN JSON_ARRAY('허리')
          WHEN \`body_parts\` LIKE '%목%' THEN JSON_ARRAY('목')
          ELSE NULL
        END
    `);

    await queryRunner.query(`
      UPDATE \`workout\`
      SET \`equipment_category\` = CASE
        WHEN \`equipments\` IS NULL OR TRIM(\`equipments\`) = '' THEN '맨몸'
        WHEN \`equipments\` LIKE '%스미스 머신%' THEN '스미스 머신'
        WHEN \`equipments\` LIKE '%케이블 머신%' THEN '케이블 머신'
        WHEN \`equipments\` LIKE '%덤벨%' THEN '덤벨'
        WHEN \`equipments\` LIKE '%케틀벨%' THEN '케틀벨'
        WHEN \`equipments\` LIKE '%바벨%' THEN '바벨'
        WHEN \`equipments\` LIKE '%밴드%' THEN '밴드'
        WHEN \`equipments\` LIKE '%맨몸%' THEN '맨몸'
        WHEN \`equipments\` LIKE '%폼롤러%' THEN '폼롤러'
        WHEN \`equipments\` LIKE '%머신%' THEN '머신'
        ELSE '기타'
      END
    `);

    await queryRunner.query(`
      UPDATE \`workout\`
      SET \`equipment_detail\` = CASE
        WHEN \`equipment_category\` IN ('머신', '기타') THEN \`equipments\`
        ELSE NULL
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`workout\`
      DROP COLUMN \`equipment_detail\`,
      DROP COLUMN \`equipment_category\`,
      DROP COLUMN \`body_part_minor\`,
      DROP COLUMN \`body_part_major\`
    `);
  }
}
