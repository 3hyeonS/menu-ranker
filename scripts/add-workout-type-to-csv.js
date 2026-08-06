const fs = require('fs');
const path = require('path');

const defaultInputPaths = [
  path.resolve(process.cwd(), 'exercisedb_all_ko_phonetic.csv'),
  path.resolve(process.cwd(), 'exercisedb_all_ko_phonetic_with_images.csv'),
];

const inputPaths = (process.env.WORKOUT_TYPE_CSV_PATHS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const targetPaths = inputPaths.length > 0 ? inputPaths : defaultInputPaths;

const cardioEquipmentTerms = [
  'stationary bike',
  'stepmill',
  'elliptical',
  '일립티컬',
  '트레드밀',
  'treadmill',
  'skierg',
  'ski erg',
  'upper body ergometer',
  'ergometer',
  '사이클',
  '바이크',
];

const cardioNameTerms = [
  '스텝밀',
  '트레드밀',
  '일립티컬',
  '크로스 트레이너',
  '크로스트레이너',
  '에르고미터',
];

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

function includesAny(value, terms) {
  const normalized = String(value || '').toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function inferWorkoutType(row, header) {
  const get = (key) => row[header.indexOf(key)] || '';
  const bodyParts = get('bodyParts');
  const equipments = get('equipments');
  const name = get('name');

  if (bodyParts.includes('유산소')) return 'cardio';
  if (includesAny(equipments, cardioEquipmentTerms)) return 'cardio';
  if (includesAny(name, cardioNameTerms)) return 'cardio';

  return 'weight';
}

function addWorkoutType(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0].map((key) => key.replace(/^\uFEFF/, ''));
  const existingTypeIndex = header.indexOf('workout_type');
  const insertIndex = header.indexOf('met') >= 0 ? header.indexOf('met') : header.length;
  const outputHeader =
    existingTypeIndex >= 0
      ? header
      : [
          ...header.slice(0, insertIndex),
          'workout_type',
          ...header.slice(insertIndex),
        ];

  const typeCounts = { cardio: 0, weight: 0 };
  const outputRows = rows.slice(1).map((row) => {
    const workoutType = inferWorkoutType(row, header);
    typeCounts[workoutType] += 1;

    if (existingTypeIndex >= 0) {
      const nextRow = [...row];
      nextRow[existingTypeIndex] = workoutType;
      return nextRow;
    }

    return [
      ...row.slice(0, insertIndex),
      workoutType,
      ...row.slice(insertIndex),
    ];
  });

  fs.writeFileSync(
    filePath,
    `${stringifyCsv([outputHeader, ...outputRows])}\n`,
  );

  return {
    filePath,
    total: outputRows.length,
    ...typeCounts,
  };
}

const results = targetPaths.map(addWorkoutType);
console.log(JSON.stringify(results, null, 2));
