import 'dotenv/config';
import { DataSource } from 'typeorm';

const port = Number(process.env.DB_PORT || 3306);
const isTsRuntime = __filename.endsWith('.ts');

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [isTsRuntime ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js'],
  migrations: [isTsRuntime ? 'src/migrations/*.ts' : 'dist/migrations/*.js'],
});
