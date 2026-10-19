import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readMenus } from './benchmark-restaurant-nutrition';

const REQUIRED_HEADERS = ['브랜드', '메뉴', '이미지 URL', '출처 URL'] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') field += character;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '').trim();
}

function main(): void {
  const manifestPath = resolve(
    process.argv.find((arg) => arg.startsWith('--manifest='))?.slice(11) ??
      'benchmark-inputs/restaurant-menu-images.csv',
  );
  const csvPath = resolve(
    process.argv.find((arg) => arg.startsWith('--csv='))?.slice(6) ??
      'menu-import-template.csv',
  );
  const rows = parseCsv(readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  const headers = rows[0]?.map((value) => value.trim()) ?? [];
  for (const header of REQUIRED_HEADERS) {
    if (!headers.includes(header)) throw new Error(`필수 열 누락: ${header}`);
  }
  const index = Object.fromEntries(
    REQUIRED_HEADERS.map((header) => [header, headers.indexOf(header)]),
  ) as Record<(typeof REQUIRED_HEADERS)[number], number>;
  const knownMenus = new Set(
    readMenus(csvPath).map((menu) => `${normalize(menu.brand)}|${normalize(menu.name)}`),
  );
  const seen = new Set<string>();
  let valid = 0;
  let duplicate = 0;
  let unmatched = 0;
  let invalidUrl = 0;
  for (const row of rows.slice(1).filter((values) => values.some((value) => value.trim()))) {
    const key = `${normalize(row[index['브랜드']] ?? '')}|${normalize(row[index['메뉴']] ?? '')}`;
    if (seen.has(key)) duplicate += 1;
    seen.add(key);
    if (!knownMenus.has(key)) unmatched += 1;
    try {
      const imageUrl = new URL(row[index['이미지 URL']] ?? '');
      const sourceUrl = new URL(row[index['출처 URL']] ?? '');
      if (imageUrl.protocol !== 'https:' || sourceUrl.protocol !== 'https:') invalidUrl += 1;
    } catch {
      invalidUrl += 1;
    }
    valid += 1;
  }
  console.log('[RESTAURANT_IMAGE_MANIFEST]', {
    rows: valid,
    duplicate,
    unmatched,
    invalidUrl,
    ready: valid > 0 && duplicate === 0 && unmatched === 0 && invalidUrl === 0,
  });
  if (!valid || duplicate || unmatched || invalidUrl) process.exitCode = 1;
}

main();
