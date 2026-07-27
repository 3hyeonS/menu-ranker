import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkoutTables1781000000000 implements MigrationInterface {
  name = 'AddWorkoutTables1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`workout\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`image\` varchar(255) NULL,
        \`gif\` varchar(255) NULL,
        \`workout_type\` varchar(20) NOT NULL,
        \`equipments\` varchar(255) NULL,
        \`body_parts\` longtext NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_workout_type_id\` (\`workout_type\`, \`id\`),
        INDEX \`IDX_workout_name\` (\`name\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`workout_record\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`date\` date NOT NULL,
        \`workout_duration\` float NOT NULL,
        \`burned_calories\` float NOT NULL,
        \`workout_type\` varchar(20) NOT NULL,
        \`intensity\` tinyint NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`userId\` int NOT NULL,
        \`workoutId\` int NOT NULL,
        UNIQUE INDEX \`IDX_workout_record_user_date_workout\` (\`userId\`, \`date\`, \`workoutId\`),
        INDEX \`IDX_workout_record_user_date\` (\`userId\`, \`date\`),
        INDEX \`IDX_workout_record_workout_id\` (\`workoutId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`workout_record_set\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`set_order\` int NOT NULL,
        \`weight\` float NOT NULL,
        \`reps\` int NOT NULL,
        \`workoutRecordId\` int NOT NULL,
        INDEX \`IDX_workout_record_set_record_order\` (\`workoutRecordId\`, \`set_order\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE \`workout_record\`
      ADD CONSTRAINT \`FK_workout_record_user\`
      FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`workout_record\`
      ADD CONSTRAINT \`FK_workout_record_workout\`
      FOREIGN KEY (\`workoutId\`) REFERENCES \`workout\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE \`workout_record_set\`
      ADD CONSTRAINT \`FK_workout_record_set_record\`
      FOREIGN KEY (\`workoutRecordId\`) REFERENCES \`workout_record\`(\`id\`)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `workout_record_set` DROP FOREIGN KEY `FK_workout_record_set_record`',
    );
    await queryRunner.query(
      'ALTER TABLE `workout_record` DROP FOREIGN KEY `FK_workout_record_workout`',
    );
    await queryRunner.query(
      'ALTER TABLE `workout_record` DROP FOREIGN KEY `FK_workout_record_user`',
    );
    await queryRunner.query('DROP TABLE `workout_record_set`');
    await queryRunner.query('DROP TABLE `workout_record`');
    await queryRunner.query('DROP TABLE `workout`');
  }
}
