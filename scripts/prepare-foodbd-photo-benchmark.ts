import { createWriteStream, existsSync } from 'fs';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const DATASET_ID = 'xh3ghf3jbg';
const VERSION = 2;
const BASE = 'https://data.mendeley.com';
const OUTPUT = join(process.cwd(), 'benchmark-inputs/public/foodbd');
const IMAGE_DIR = join(OUTPUT, 'images');
const DOWNLOAD_IMAGES = process.argv.includes('--download-images');
const CONCURRENCY = 8;

type RemoteFile = {
  filename: string;
  content_details: { size: number; download_url: string };
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json() as Promise<T>;
}

async function listAllFiles(folderId: string): Promise<RemoteFile[]> {
  const files: RemoteFile[] = [];
  for (let start = 0; ; start += 1000) {
    const url = `${BASE}/public-api/datasets/${DATASET_ID}/files?folder_id=${folderId}&version=${VERSION}&%24start=${start}&%24limit=1000`;
    const page = await getJson<RemoteFile[]>(url);
    files.push(...page);
    if (page.length < 1000) return files;
  }
}

async function download(url: string, destination: string): Promise<void> {
  if (existsSync(destination)) return;
  const partial = `${destination}.partial`;
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`${response.status} ${url}`);
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(partial));
  await rename(partial, destination);
}

async function main(): Promise<void> {
  await mkdir(IMAGE_DIR, { recursive: true });
  const nutritionRows = parseCsv(
    await readFile(join(OUTPUT, 'MealNutrition1837_All.csv'), 'utf8'),
  );
  const metadataRows = parseCsv(
    await readFile(join(OUTPUT, 'FoodBD_Meta_data.csv'), 'utf8'),
  );
  const names = new Map(metadataRows.slice(1).map((r) => [r[0], r[1]]));
  const wanted = new Set(nutritionRows.slice(1).map((r) => r[0]));

  const folders = await getJson<Array<{ id: string; name: string }>>(
    `${BASE}/public-api/datasets/${DATASET_ID}/folders/${VERSION}`,
  );
  const imageFolders = folders.filter((folder) => folder.name === 'images');
  const allFiles = (
    await Promise.all(imageFolders.map((folder) => listAllFiles(folder.id)))
  ).flat();
  const imageFiles = [
    ...new Map(
      allFiles
        .filter((file) => wanted.has(file.filename))
        .map((file) => [file.filename, file]),
    ).values(),
  ];
  const remoteByName = new Map(imageFiles.map((file) => [file.filename, file]));

  const manifest = nutritionRows.slice(1).map((row) => ({
    item_id: row[0].replace(/\.jpg$/i, ''),
    menu_name: names.get(row[0])?.replaceAll(',', ', ') ?? null,
    image_path: `images/${row[0]}`,
    calories_kcal: Number(row[5]),
    carbohydrate_g: Number(row[1]),
    protein_g: Number(row[2]),
    fat_g: Number(row[3]),
    fiber_g: Number(row[4]),
    source_dataset: `FoodBD v${VERSION}`,
    source_doi: '10.17632/xh3ghf3jbg.2',
    license: 'CC BY 4.0',
  }));
  const excluded = manifest.filter(
    (row) =>
      !row.menu_name || !remoteByName.has(basename(row.image_path)),
  );
  const matchedManifest = manifest.filter(
    (row) => row.menu_name && remoteByName.has(basename(row.image_path)),
  );
  await writeFile(
    join(OUTPUT, 'benchmark-manifest.json'),
    `${JSON.stringify(matchedManifest, null, 2)}\n`,
  );
  await writeFile(
    join(OUTPUT, 'excluded-unmatched.json'),
    `${JSON.stringify(excluded, null, 2)}\n`,
  );

  const bytes = imageFiles.reduce(
    (sum, file) => sum + file.content_details.size,
    0,
  );
  console.log(
    `Matched ${matchedManifest.length} rows and ${imageFiles.length} images (${(
      bytes / 1024 / 1024
    ).toFixed(1)} MiB); excluded ${excluded.length} unmatched rows.`,
  );
  if (!DOWNLOAD_IMAGES) {
    console.log('Use --download-images to download the matched image subset.');
    return;
  }

  let next = 0;
  let completed = 0;
  async function worker(): Promise<void> {
    while (next < imageFiles.length) {
      const file = imageFiles[next++];
      await download(
        file.content_details.download_url,
        join(IMAGE_DIR, file.filename),
      );
      completed += 1;
      if (completed % 100 === 0 || completed === imageFiles.length) {
        console.log(`Downloaded ${completed}/${imageFiles.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
