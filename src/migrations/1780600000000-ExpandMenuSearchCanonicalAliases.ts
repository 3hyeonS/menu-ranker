import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  canonicalizeMenuSearchName,
  normalizeMenuSearchName,
} from '../utils/menu-name.util';

type MenuSearchRow = {
  id: number;
  name: string;
  search_name: string | null;
  canonical_name: string | null;
};

export class ExpandMenuSearchCanonicalAliases1780600000000
  implements MigrationInterface
{
  name = 'ExpandMenuSearchCanonicalAliases1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(`
      SELECT \`id\`, \`name\`, \`search_name\`, \`canonical_name\`
      FROM \`menu\`
      WHERE \`name\` IS NOT NULL
    `);

    await this.updateMenuSearchFields(queryRunner, rows, (name) => ({
      searchName: normalizeMenuSearchName(name),
      canonicalName: canonicalizeMenuSearchName(name),
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(`
      SELECT \`id\`, \`name\`, \`search_name\`, \`canonical_name\`
      FROM \`menu\`
      WHERE \`name\` IS NOT NULL
    `);

    await this.updateMenuSearchFields(queryRunner, rows, (name) => {
      const searchName = normalizeMenuSearchName(name);
      const canonicalName = searchName
        .replace(/계란/g, '달걀')
        .replace(/후라이/g, '프라이')
        .replace(/소세지/g, '소시지')
        .replace(/쥬스/g, '주스')
        .replace(/돈까스/g, '돈가스');

      return { searchName, canonicalName };
    });
  }

  private async updateMenuSearchFields(
    queryRunner: QueryRunner,
    rows: MenuSearchRow[],
    normalize: (name: string) => { searchName: string; canonicalName: string },
  ): Promise<void> {
    const updates = rows
      .map((row) => {
        const id = Number(row.id);

        if (!Number.isInteger(id)) {
          return null;
        }

        const { searchName, canonicalName } = normalize(row.name);

        if (
          row.search_name === searchName &&
          row.canonical_name === canonicalName
        ) {
          return null;
        }

        return { id, searchName, canonicalName };
      })
      .filter(
        (
          row,
        ): row is { id: number; searchName: string; canonicalName: string } =>
          !!row,
      );

    const batchSize = 500;

    for (let index = 0; index < updates.length; index += batchSize) {
      const batch = updates.slice(index, index + batchSize);
      const searchCase = batch.map(() => 'WHEN ? THEN ?').join(' ');
      const canonicalCase = batch.map(() => 'WHEN ? THEN ?').join(' ');
      const idPlaceholders = batch.map(() => '?').join(', ');
      const searchParams = batch.flatMap((row) => [row.id, row.searchName]);
      const canonicalParams = batch.flatMap((row) => [
        row.id,
        row.canonicalName,
      ]);
      const idParams = batch.map((row) => row.id);

      await queryRunner.query(
        `
          UPDATE \`menu\`
          SET
            \`search_name\` = CASE \`id\` ${searchCase} ELSE \`search_name\` END,
            \`canonical_name\` = CASE \`id\` ${canonicalCase} ELSE \`canonical_name\` END
          WHERE \`id\` IN (${idPlaceholders})
        `,
        [...searchParams, ...canonicalParams, ...idParams],
      );
    }
  }
}
