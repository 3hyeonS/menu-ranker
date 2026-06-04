import { existsSync, readFileSync } from 'fs';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

const isEnabled = (value: string | undefined): boolean =>
  ['1', 'true', 'yes', 'y'].includes((value ?? '').toLowerCase());

const createSslOptions = (): PostgresConnectionOptions['ssl'] => {
  if (!isEnabled(process.env.VECTOR_DB_SSL)) {
    return undefined;
  }

  const caPath = process.env.VECTOR_DB_SSL_CA_PATH;

  if (caPath && existsSync(caPath)) {
    return {
      ca: readFileSync(caPath).toString(),
      rejectUnauthorized: true,
    };
  }

  return {
    rejectUnauthorized: isEnabled(process.env.VECTOR_DB_SSL_REJECT_UNAUTHORIZED),
  };
};

export const createVectorDataSourceOptions = (): PostgresConnectionOptions => ({
  type: 'postgres',
  host: process.env.VECTOR_DB_HOST ?? 'localhost',
  port: Number(process.env.VECTOR_DB_PORT ?? 5432),
  username: process.env.VECTOR_DB_USERNAME ?? 'vector_user',
  password: process.env.VECTOR_DB_PASSWORD ?? 'vector_password',
  database: process.env.VECTOR_DB_NAME ?? 'melo_vector',
  synchronize: false,
  logging: false,
  ssl: createSslOptions(),
});
