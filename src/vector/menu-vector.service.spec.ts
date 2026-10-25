import { MenuVectorService } from './menu-vector.service';

describe('MenuVectorService search session settings', () => {
  const savedEfSearch = process.env.VECTOR_HNSW_EF_SEARCH;

  afterEach(() => {
    if (savedEfSearch === undefined) {
      delete process.env.VECTOR_HNSW_EF_SEARCH;
    } else {
      process.env.VECTOR_HNSW_EF_SEARCH = savedEfSearch;
    }
  });

  function createService() {
    const queryRunner = {
      connect: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      release: jest.fn(),
    };
    const service = new MenuVectorService(
      {
        isInitialized: true,
        createQueryRunner: () => queryRunner,
      } as any,
      {} as any,
    ) as any;

    return { service, queryRunner };
  }

  it('sets hnsw.ef_search (not ivfflat.probes) for the HNSW index', async () => {
    delete process.env.VECTOR_HNSW_EF_SEARCH;
    const { service, queryRunner } = createService();

    await service.queryVectorSearch('SELECT 1', []);

    const statements = queryRunner.query.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(statements).toContain('SET hnsw.ef_search = 40');
    expect(statements.some((sql: string) => sql.includes('ivfflat'))).toBe(
      false,
    );
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('clamps VECTOR_HNSW_EF_SEARCH to pgvector limits', async () => {
    process.env.VECTOR_HNSW_EF_SEARCH = '5000';
    const { service, queryRunner } = createService();

    await service.queryVectorSearch('SELECT 1', []);

    expect(queryRunner.query).toHaveBeenCalledWith('SET hnsw.ef_search = 1000');
  });
});
