const fs = require('fs');
const path = require('path');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error(
    'sharp is required. Install it with: npm install sharp',
  );
  process.exit(1);
}

const inputPath =
  process.env.WORKOUT_THUMBNAIL_INPUT ??
  path.resolve(process.cwd(), 'exercisedb_all_ko_phonetic.csv');
const outputPath =
  process.env.WORKOUT_THUMBNAIL_OUTPUT ??
  path.resolve(process.cwd(), 'exercisedb_all_ko_phonetic_with_images.csv');
const concurrency = Math.max(
  1,
  Number(process.env.WORKOUT_THUMBNAIL_CONCURRENCY ?? 5),
);
const startIndex = Math.max(
  0,
  Number(process.env.WORKOUT_THUMBNAIL_START_INDEX ?? 0),
);
const stopIndex = Math.max(
  0,
  Number(process.env.WORKOUT_THUMBNAIL_STOP_INDEX ?? 0),
);
const limit = Math.max(0, Number(process.env.WORKOUT_THUMBNAIL_LIMIT ?? 0));
const force = process.env.WORKOUT_THUMBNAIL_FORCE === 'true';
const dryRun = process.env.WORKOUT_THUMBNAIL_DRY_RUN === 'true';
const onlyMissing = process.env.WORKOUT_THUMBNAIL_ONLY_MISSING === 'true';
const requestTimeoutMs = Math.max(
  1000,
  Number(process.env.WORKOUT_THUMBNAIL_REQUEST_TIMEOUT_MS ?? 15000),
);
const progressEvery = Math.max(
  1,
  Number(process.env.WORKOUT_THUMBNAIL_PROGRESS_EVERY ?? 1),
);
const saveEvery = Math.max(
  1,
  Number(process.env.WORKOUT_THUMBNAIL_SAVE_EVERY ?? concurrency),
);
const s3Prefix =
  process.env.WORKOUT_THUMBNAIL_S3_PREFIX ?? 'workout-images';
const bucketName =
  process.env.WORKOUT_THUMBNAIL_S3_BUCKET ??
  process.env.AWS_S3_BUCKET_NAME ??
  process.env.AWS_S3_BUCKET ??
  process.env.S3_BUCKET_NAME ??
  process.env.S3_BUCKET;
const region =
  process.env.WORKOUT_THUMBNAIL_S3_REGION ??
  process.env.AWS_REGION ??
  process.env.AWS_DEFAULT_REGION ??
  'ap-northeast-2';

if (!dryRun && !bucketName) {
  console.error(
    'AWS_S3_BUCKET_NAME or WORKOUT_THUMBNAIL_S3_BUCKET is required.',
  );
  process.exit(1);
}

const s3 = dryRun
  ? null
  : new S3Client({
      region,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value);
      value = '';
      if (row.length > 1 || row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function stringifyCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = value == null ? '' : String(value);
          const escaped = text.replace(/"/g, '""');
          return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(','),
    )
    .join('\n');
}

function rowsToObjects(rows) {
  const [header, ...body] = rows;
  const cleanHeader = header.map((key) => key.replace(/^\uFEFF/, ''));
  return body.map((row) =>
    Object.fromEntries(cleanHeader.map((key, index) => [key, row[index] ?? ''])),
  );
}

function objectsToRows(objects, header) {
  return [header, ...objects.map((row) => header.map((key) => row[key] ?? ''))];
}

function loadCsvObjects(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0].map((key) => key.replace(/^\uFEFF/, ''));
  return { header, objects: rowsToObjects(rows) };
}

function mergeExistingOutput(inputObjects) {
  if (!fs.existsSync(outputPath)) return inputObjects;

  const existing = loadCsvObjects(outputPath).objects;
  const byExerciseId = new Map(
    existing
      .filter((row) => row.exerciseId)
      .map((row) => [row.exerciseId, row.imageUrl ?? '']),
  );

  return inputObjects.map((row) => ({
    ...row,
    imageUrl: row.imageUrl || byExerciseId.get(row.exerciseId) || '',
  }));
}

function writeOutput(objects, header) {
  fs.writeFileSync(outputPath, `${stringifyCsv(objectsToRows(objects, header))}\n`);
}

function normalizePrefix(prefix) {
  return prefix.replace(/^\/+|\/+$/g, '');
}

function imageUrlForKey(key) {
  if (dryRun) return `dry-run://${key}`;
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${requestTimeoutMs}ms`)),
      requestTimeoutMs,
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function downloadGif(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`download failed: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(
    await withTimeout(res.arrayBuffer(), 'reading gif response'),
  );
}

async function gifToWebp(gifBuffer) {
  return sharp(gifBuffer, { animated: false })
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

async function uploadWebp(key, body) {
  if (dryRun) return;
  await withTimeout(
    s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: 'image/webp',
      }),
    ),
    's3 upload',
  );
}

async function processRow(row, index) {
  if (!row.exerciseId) throw new Error('exerciseId is empty');
  if (!row.gifUrl) throw new Error('gifUrl is empty');
  if (row.imageUrl && !force) {
    return { skipped: true, imageUrl: row.imageUrl };
  }

  const key = `${normalizePrefix(s3Prefix)}/${row.exerciseId}.webp`;
  const gif = await downloadGif(row.gifUrl);
  const webp = await gifToWebp(gif);
  await uploadWebp(key, webp);

  return {
    skipped: false,
    imageUrl: imageUrlForKey(key),
    bytes: webp.length,
    index,
  };
}

async function runPool(items, worker) {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const current = cursor;
        cursor += 1;
        await worker(items[current], current);
      }
    },
  );
  await Promise.all(workers);
}

async function main() {
  const { header: inputHeader, objects: inputObjects } = loadCsvObjects(inputPath);
  const header = inputHeader.includes('imageUrl')
    ? inputHeader
    : [...inputHeader, 'imageUrl'];
  const objects = mergeExistingOutput(inputObjects);

  let endIndex = stopIndex > 0 ? Math.min(stopIndex, objects.length) : objects.length;

  const scopedTargets = objects
    .slice(startIndex, endIndex)
    .map((row, offset) => ({ row, index: startIndex + offset }))
    .filter(({ row }) => !onlyMissing || force || !row.imageUrl);
  const targets = limit > 0 ? scopedTargets.slice(0, limit) : scopedTargets;

  let uploadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const startedAt = Date.now();

  console.log('[WORKOUT_THUMBNAIL] started', {
    inputPath,
    outputPath,
    totalRows: objects.length,
    targetRows: targets.length,
    startIndex,
    endIndex,
    concurrency,
    requestTimeoutMs,
    onlyMissing,
    progressEvery,
    saveEvery,
    bucketName: dryRun ? 'DRY_RUN' : bucketName,
    region,
    s3Prefix,
  });

  await runPool(targets, async ({ row, index }) => {
    const rowStartedAt = Date.now();
    try {
      const result = await processRow(row, index);
      row.imageUrl = result.imageUrl;
      if (result.skipped) skippedCount += 1;
      else uploadedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error('[WORKOUT_THUMBNAIL] failed', {
        index,
        exerciseId: row.exerciseId,
        name: row.name,
        message: error.message,
        durationMs: Date.now() - rowStartedAt,
      });
    }

    const processedCount = uploadedCount + skippedCount + failedCount;
    if (processedCount % saveEvery === 0 || processedCount === targets.length) {
      writeOutput(objects, header);
    }

    if (processedCount % progressEvery === 0 || processedCount === targets.length) {
      console.log('[WORKOUT_THUMBNAIL] progress', {
        processedCount,
        remainingCount: targets.length - processedCount,
        uploadedCount,
        skippedCount,
        failedCount,
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
      });
    }
  });

  writeOutput(objects, header);
  console.log('[WORKOUT_THUMBNAIL] completed', {
    uploadedCount,
    skippedCount,
    failedCount,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    outputPath,
  });

  if (failedCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[WORKOUT_THUMBNAIL] aborted', error);
  process.exit(1);
});
