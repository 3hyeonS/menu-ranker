import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MenuEntity } from '../home/entity/menu.entity';
import { EmbeddingService } from './embedding.service';
import { VECTOR_DATA_SOURCE } from './vector-db.provider';

export type MenuVectorSearchResult = {
  menuId: number;
  distance: number;
};

export type MenuVectorSearchOptions = {
  userId: number;
  limit: number;
  brand?: string | null;
  category?: string | null;
  namePrefix?: string | null;
  maxCalories?: number | null;
  minProtein?: number | null;
};

@Injectable()
export class MenuVectorService {
  private readonly defaultEmbeddingDimension = 768;

  constructor(
    @Inject(VECTOR_DATA_SOURCE)
    private readonly vectorDataSource: DataSource,
    private readonly embeddingService: EmbeddingService,
  ) {}

  buildMenuSearchText(menu: MenuEntity): string {
    return [
      `메뉴명: ${menu.name}`,
      menu.brand ? `브랜드: ${menu.brand}` : null,
      menu.category ? `카테고리: ${menu.category}` : null,
      `영양정보: ${menu.calories ?? 0}kcal`,
      `탄수화물 ${menu.carbs ?? 0}g`,
      `단백질 ${menu.protein ?? 0}g`,
      `지방 ${menu.fat ?? 0}g`,
      `당류 ${menu.sugars ?? 0}g`,
      `나트륨 ${menu.sodium ?? 0}mg`,
    ]
      .filter((value): value is string => !!value)
      .join('\n');
  }

  async upsertMenu(menu: MenuEntity, textEmbedding?: number[]): Promise<void> {
    const searchText = this.buildMenuSearchText(menu);
    const embedding =
      textEmbedding ?? (await this.embeddingService.embedText(searchText));

    this.assertEmbeddingDimension(embedding);

    await this.query(
      `
      INSERT INTO menu_vector_index (
        menu_id,
        owner_user_id,
        data_source,
        is_deleted,
        name,
        brand,
        category,
        search_text,
        visual_text,
        calories,
        carbs,
        protein,
        fat,
        sugars,
        sodium,
        text_embedding,
        source_updated_at,
        embedded_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16::vector,
        now(), now()
      )
      ON CONFLICT (menu_id)
      DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        data_source = EXCLUDED.data_source,
        is_deleted = EXCLUDED.is_deleted,
        name = EXCLUDED.name,
        brand = EXCLUDED.brand,
        category = EXCLUDED.category,
        search_text = EXCLUDED.search_text,
        visual_text = EXCLUDED.visual_text,
        calories = EXCLUDED.calories,
        carbs = EXCLUDED.carbs,
        protein = EXCLUDED.protein,
        fat = EXCLUDED.fat,
        sugars = EXCLUDED.sugars,
        sodium = EXCLUDED.sodium,
        text_embedding = EXCLUDED.text_embedding,
        source_updated_at = now(),
        embedded_at = now()
      `,
      [
        menu.id,
        menu.user?.id ?? null,
        menu.data_source,
        menu.is_deleted ?? 0,
        menu.name,
        menu.brand ?? null,
        menu.category ?? null,
        searchText,
        null,
        menu.calories ?? null,
        menu.carbs ?? null,
        menu.protein ?? null,
        menu.fat ?? null,
        menu.sugars ?? null,
        menu.sodium ?? null,
        this.toVectorLiteral(embedding),
      ],
    );
  }

  async markMenuDeleted(menuId: number): Promise<void> {
    await this.query(
      `
      UPDATE menu_vector_index
      SET is_deleted = 1, source_updated_at = now()
      WHERE menu_id = $1
      `,
      [menuId],
    );
  }

  async deleteMenu(menuId: number): Promise<void> {
    await this.query(
      'DELETE FROM menu_vector_index WHERE menu_id = $1',
      [menuId],
    );
  }

  async findIndexedMenuIds(menuIds: number[]): Promise<Set<number>> {
    if (menuIds.length === 0) {
      return new Set();
    }

    const rows = await this.query(
      `
      SELECT menu_id AS "menuId"
      FROM menu_vector_index
      WHERE menu_id = ANY($1::int[])
      `,
      [menuIds],
    );

    return new Set(
      rows.map((row: { menuId: number | string }) => Number(row.menuId)),
    );
  }

  async searchMenusByText(
    query: string,
    options: MenuVectorSearchOptions,
  ): Promise<MenuVectorSearchResult[]> {
    const embedding = await this.embeddingService.embedText(query);

    return await this.searchMenusByEmbedding(embedding, options);
  }

  async searchMenusByEmbedding(
    embedding: number[],
    options: MenuVectorSearchOptions,
  ): Promise<MenuVectorSearchResult[]> {
    this.assertEmbeddingDimension(embedding);

    const params: unknown[] = [
      options.userId,
      this.toVectorLiteral(embedding),
      Math.max(options.limit, 1),
    ];
    const conditions = [
      'is_deleted = 0',
      '(owner_user_id IS NULL OR owner_user_id = $1)',
    ];

    if (options.brand) {
      params.push(`%${options.brand}%`);
      conditions.push(`brand ILIKE $${params.length}`);
    }

    if (options.category) {
      params.push(`%${options.category}%`);
      conditions.push(`category ILIKE $${params.length}`);
    }

    if (options.namePrefix) {
      params.push(`${options.namePrefix}%`);
      conditions.push(`name LIKE $${params.length}`);
    }

    if (options.maxCalories !== null && options.maxCalories !== undefined) {
      params.push(options.maxCalories);
      conditions.push(`calories <= $${params.length}`);
    }

    if (options.minProtein !== null && options.minProtein !== undefined) {
      params.push(options.minProtein);
      conditions.push(`protein >= $${params.length}`);
    }

    const rows = await this.queryVectorSearch(
      `
      SELECT
        menu_id AS "menuId",
        text_embedding <=> $2::vector AS distance
      FROM menu_vector_index
      WHERE ${conditions.join(' AND ')}
      ORDER BY text_embedding <=> $2::vector ASC
      LIMIT $3
      `,
      params,
    );

    return rows.map((row: { menuId: number | string; distance: number | string }) => ({
      menuId: Number(row.menuId),
      distance: Number(row.distance),
    }));
  }

  private getIvfflatProbes(): number {
    const parsed = Number(process.env.VECTOR_IVFFLAT_PROBES ?? 10);

    if (!Number.isFinite(parsed)) {
      return 10;
    }

    return Math.max(1, Math.min(Math.floor(parsed), 1000));
  }

  private assertEmbeddingDimension(embedding: number[]): void {
    const dimension = Number(
      process.env.VECTOR_EMBEDDING_DIMENSION ?? this.defaultEmbeddingDimension,
    );

    if (
      embedding.length !== dimension ||
      embedding.some((value) => !Number.isFinite(value))
    ) {
      throw new Error(
        `Embedding dimension mismatch: expected ${dimension}, got ${embedding.length}`,
      );
    }
  }

  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  private async query<T = any>(sql: string, params?: unknown[]): Promise<T> {
    if (!this.vectorDataSource.isInitialized) {
      await this.vectorDataSource.initialize();
    }

    return await this.vectorDataSource.query(sql, params);
  }

  private async queryVectorSearch<T = any>(
    sql: string,
    params?: unknown[],
  ): Promise<T> {
    if (!this.vectorDataSource.isInitialized) {
      await this.vectorDataSource.initialize();
    }

    const queryRunner = this.vectorDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.query(
        `SET ivfflat.probes = ${this.getIvfflatProbes()}`,
      );

      return await queryRunner.query(sql, params);
    } finally {
      await queryRunner.release();
    }
  }
}
