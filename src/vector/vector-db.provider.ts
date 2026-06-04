import { DataSource } from 'typeorm';
import { createVectorDataSourceOptions } from './vector-db-options';

export const VECTOR_DATA_SOURCE = Symbol('VECTOR_DATA_SOURCE');

export const vectorDataSourceProvider = {
  provide: VECTOR_DATA_SOURCE,
  useFactory: async (): Promise<DataSource> => {
    const dataSource = new DataSource(createVectorDataSourceOptions());

    return await dataSource.initialize();
  },
};
