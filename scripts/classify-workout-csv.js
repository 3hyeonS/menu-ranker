const fs = require('fs');
const path = require('path');

const filePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', 'exercisedb_all_ko_phonetic_with_images.csv');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (character !== '\r') {
      value += character;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function escapeCsv(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeEquipment(equipment) {
  const value = (equipment || '').trim();
  const key = value.toLowerCase().replace(/[\s_-]/g, '');
  const aliases = {
    ez바벨: '이지 바벨',
    olympicbarbell: '올림픽 바벨',
    trapbar: '트랩 바벨',
    hammer: '해머',
    skiergmachine: '스키에르그 머신',
    stationarybike: '고정식 자전거',
    stepmillmachine: '스텝밀 머신',
    tire: '타이어',
    upperbodyergometer: '상체 에르고미터',
    케이블: '케이블 머신',
    저항밴드: '밴드',
    롤러: '폼롤러',
    휠롤러: '폼롤러',
  };

  return aliases[key] || value;
}

function classifyEquipment(equipment) {
  if (!equipment) {
    return { category: '맨몸', detail: '' };
  }

  const normalized = normalizeEquipment(equipment);
  const value = normalized.toLowerCase();
  let category;

  if (value.includes('스미스 머신')) category = '스미스 머신';
  else if (value.includes('케이블 머신')) category = '케이블 머신';
  else if (value.includes('덤벨')) category = '덤벨';
  else if (value.includes('케틀벨')) category = '케틀벨';
  else if (value.includes('바벨')) category = '바벨';
  else if (value.includes('밴드')) category = '밴드';
  else if (value.includes('맨몸')) category = '맨몸';
  else if (value.includes('폼롤러')) category = '폼롤러';
  else if (value.includes('머신')) category = '머신';
  else category = '기타';

  return {
    category,
    // 머신은 대분류만으로 실제 사용 장비를 구별할 수 없어 상세명을 함께 보관한다.
    detail: ['머신', '기타'].includes(category) ? normalized : '',
  };
}

function classifyBodyParts(bodyParts, workoutType) {
  if ((workoutType || '').toLowerCase() === 'cardio') {
    return { major: '유산소', minor: '' };
  }

  const values = (bodyParts || '')
    .split(/[|,;/]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const minor = values.filter((value) =>
    ['복부', '허리', '상완', '전완', '종아리', '허벅지', '목'].includes(value),
  );

  if (values.some((value) => ['허벅지', '종아리'].includes(value))) {
    return { major: '하체', minor: minor.join(' | ') };
  }
  if (values.some((value) => ['상완', '전완'].includes(value))) {
    return { major: '팔', minor: minor.join(' | ') };
  }
  if (values.some((value) => ['복부', '허리', '목'].includes(value))) {
    return { major: '코어', minor: minor.join(' | ') };
  }

  const major = values.find((value) =>
    ['가슴', '등', '하체', '어깨', '팔', '코어', '유산소'].includes(value),
  );
  return { major: major || '코어', minor: minor.join(' | ') };
}

const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
if (rows.length === 0) {
  throw new Error('CSV is empty');
}

const sourceHeader = rows[0].map((value) =>
  value.replace(/^\uFEFF/, '').trim(),
);
const legacyColumns = new Set([
  'bodyParts',
  'body_parts',
  'equipments',
  'equipment',
]);
const header = sourceHeader.filter((column) => !legacyColumns.has(column));
const requiredColumns = [
  'bodyPartMajor',
  'bodyPartMinor',
  'equipmentCategory',
  'equipmentDetail',
  'equipmentOriginalDetail',
];

for (const column of requiredColumns) {
  if (!header.includes(column)) header.push(column);
}

const indexOf = (column) => header.indexOf(column);
const sourceIndexOf = (column) => sourceHeader.indexOf(column);
const getSourceValue = (row, columns) => {
  for (const column of columns) {
    const index = sourceIndexOf(column);
    const value = index >= 0 ? row[index] : '';
    if (value && value.trim()) return value.trim();
  }
  return '';
};

const outputRows = rows.slice(1).map((sourceRow) => {
  const sourceValues = new Map(
    sourceHeader.map((column, index) => [column, sourceRow[index] ?? '']),
  );
  const row = header.map((column) => sourceValues.get(column) ?? '');
  const rawBodyParts = getSourceValue(sourceRow, [
    'bodyParts',
    'body_parts',
    'bodyPart',
    'body_part',
  ]);
  const rawEquipment = getSourceValue(sourceRow, [
    'equipmentOriginalDetail',
    'equipment_original_detail',
    'equipments',
    'equipment',
  ]);
  const bodyPart = classifyBodyParts(
    rawBodyParts,
    row[indexOf('workout_type')] ?? '',
  );
  const equipment = classifyEquipment(rawEquipment);

  row[indexOf('bodyPartMajor')] ||= bodyPart.major;
  row[indexOf('bodyPartMinor')] ||= bodyPart.minor;
  row[indexOf('equipmentCategory')] ||= equipment.category;
  row[indexOf('equipmentDetail')] ||= equipment.detail;
  row[indexOf('equipmentOriginalDetail')] = rawEquipment;
  return row;
});

const output = [header, ...outputRows]
  .map((row) => row.map(escapeCsv).join(','))
  .join('\n');

fs.writeFileSync(filePath, `${output}\n`, 'utf8');
console.log(`Updated ${rows.length - 1} workouts: ${filePath}`);
