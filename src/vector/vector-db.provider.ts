import { DataSource } from 'typeorm';

export const VECTOR_DATA_SOURCE = Symbol('VECTOR_DATA_SOURCE');

export const vectorDataSourceProvider = {
  provide: VECTOR_DATA_SOURCE,
  useFactory: async (): Promise<DataSource> => {
    const dataSource = new DataSource({
      type: 'postgres',
      host: process.env.VECTOR_DB_HOST ?? 'localhost',
      port: Number(process.env.VECTOR_DB_PORT ?? 5432),
      username: process.env.VECTOR_DB_USERNAME ?? 'vector_user',
      password: process.env.VECTOR_DB_PASSWORD ?? 'vector_password',
      database: process.env.VECTOR_DB_NAME ?? 'melo_vector',
      synchronize: false,
      logging: false,
    });

    return await dataSource.initialize();
  },
};
