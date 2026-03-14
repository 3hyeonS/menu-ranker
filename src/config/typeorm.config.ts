import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'mysql', // 사용할 데이터베이스 유형 (MySQL, PostgreSQL, SQLite 등)
  host: process.env.DB_HOST, // 데이터베이스 호스트
  port: parseInt(process.env.DB_PORT, 10), // 데이터베이스 포트
  username: process.env.DB_USERNAME, // 데이터베이스 사용자 이름
  password: process.env.DB_PASSWORD, // 데이터베이스 비밀번호
  database: process.env.DB_NAME, // 사용할 데이터베이스 이름
  entities: [__dirname + '/../**/*.entity.{js,ts}'],
  synchronize: false,
  migrations: [__dirname + '/**/migrations/*{.ts,.js}}'],
  migrationsRun: false,
  migrationsTableName: 'migrations',
  // logging: true, // SQL 쿼리 로그를 출력할지 여부
};
