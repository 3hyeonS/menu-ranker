const fs = require('fs');
const path = require('path');
require('dotenv').config();

const inputPath =
  process.env.EXERCISE_TRANSLATE_INPUT ?? '/home/sehyeon/exercisedb_all.csv';
const outputPath =
  process.env.EXERCISE_TRANSLATE_OUTPUT ??
  path.resolve(process.cwd(), 'exercisedb_all_ko_phonetic.csv');
const batchSize = Number(process.env.EXERCISE_TRANSLATE_BATCH_SIZE ?? 15);
const startIndex = Number(process.env.EXERCISE_TRANSLATE_START_INDEX ?? 0);
const stopIndex = Number(process.env.EXERCISE_TRANSLATE_STOP_INDEX ?? 0);
const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
const apiKey = process.env.GEMINI_API_KEY;

const dictionary = {
  back: '등',
  waist: '허리/복부',
  chest: '가슴',
  shoulders: '어깨',
  'upper arms': '상완',
  'lower arms': '전완',
  'upper legs': '허벅지',
  'lower legs': '종아리',
  cardio: '유산소',
  neck: '목',
  'body weight': '맨몸',
  dumbbell: '덤벨',
  cable: '케이블',
  barbell: '바벨',
  'leverage machine': '레버리지 머신',
  band: '밴드',
  'smith machine': '스미스 머신',
  kettlebell: '케틀벨',
  weighted: '중량',
  'stability ball': '짐볼',
  'ez barbell': 'EZ 바벨',
  assisted: '보조 기구',
  'sled machine': '슬레드 머신',
  'medicine ball': '메디신볼',
  rope: '로프',
  'resistance band': '저항 밴드',
  roller: '롤러',
  'bosu ball': '보수볼',
  'elliptical machine': '일립티컬 머신',
  'wheel roller': '휠 롤러',
  abs: '복근',
  pectorals: '대흉근',
  glutes: '둔근',
  biceps: '이두근',
  triceps: '삼두근',
  delts: '삼각근',
  'upper back': '상부 등',
  lats: '광배근',
  calves: '종아리',
  quads: '대퇴사두근',
  forearms: '전완근',
  'cardiovascular system': '심폐 지구력',
  hamstrings: '햄스트링',
  spine: '척추',
  traps: '승모근',
  abductors: '외전근',
  'serratus anterior': '전거근',
  adductors: '내전근',
  'levator scapulae': '견갑거근',
  core: '코어',
  'hip flexors': '고관절 굴곡근',
};

if (!apiKey) {
  console.error('GEMINI_API_KEY is required in .env');
  process.exit(1);
}

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
  return body.map((row) =>
    Object.fromEntries(header.map((key, index) => [key.replace(/^\uFEFF/, ''), row[index] ?? ''])),
  );
}

function translateList(value) {
  return value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => dictionary[part.toLowerCase()] ?? part)
    .join(' | ');
}

function extractJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON array found: ${trimmed.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

async function translateBatch(batch) {
  const prompt = `
다음 운동 CSV 데이터를 한국어로 번역해줘.

규칙:
- JSON 배열만 반환해.
- 각 항목은 exerciseId, name_ko, instructions_ko 필드만 포함해.
- exerciseId는 원문 그대로 유지해.
- name_ko는 의미 번역하지 말고 영어 운동명을 한국어 발음으로 음차해. 예: dumbbell squat -> 덤벨 스쿼트, cable lateral raise -> 케이블 레터럴 레이즈, upward facing dog -> 업워드 페이싱 독.
- 이미 한국 운동 사용자들이 자주 쓰는 외래어 표현이 있으면 그 표현을 우선해. 예: push-up -> 푸시업, pull-up -> 풀업, squat -> 스쿼트, lunge -> 런지, plank -> 플랭크.
- left/right, front/back, standing, seated 같은 방향/자세 설명도 가능한 한 한국어 의미 번역 대신 외래어식 표현으로 유지해. 예: standing -> 스탠딩, seated -> 시티드, reverse -> 리버스.
- instructions_ko는 원문의 Step 번호를 유지하고, 각 단계는 "Step:1 ..." 형식으로 번역해.
- 운동 용어는 한국 사용자가 이해하기 쉬운 표현을 사용해.
- gifUrl, 숫자, URL은 번역하지 마.

데이터:
${JSON.stringify(
  batch.map((row) => ({
    exerciseId: row.exerciseId,
    name: row.name,
    instructions: row.instructions,
  })),
)}
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }

  const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Gemini returned empty content');
  return extractJson(content);
}

async function main() {
  const csvText = fs.readFileSync(inputPath, 'utf8');
  const objects = rowsToObjects(parseCsv(csvText));
  const limitedRows =
    stopIndex > 0 ? objects.slice(startIndex, stopIndex) : objects.slice(startIndex);
  const translated = [];

  for (let i = 0; i < limitedRows.length; i += batchSize) {
    const batch = limitedRows.slice(i, i + batchSize);
    const batchIndex = startIndex + i;

    let result;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        result = await translateBatch(batch);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        const delayMs = 1500 * attempt;
        console.warn(`[translate] retry ${attempt} at row ${batchIndex}: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const byId = new Map(result.map((item) => [item.exerciseId, item]));
    for (const row of batch) {
      const ko = byId.get(row.exerciseId) ?? {};
      translated.push({
        ...row,
        name: ko.name_ko || row.name,
        bodyParts: translateList(row.bodyParts),
        equipments: translateList(row.equipments),
        targetMuscles: translateList(row.targetMuscles),
        secondaryMuscles: translateList(row.secondaryMuscles),
        instructions: ko.instructions_ko || row.instructions,
      });
    }

    console.log(`[translate] ${Math.min(i + batchSize, limitedRows.length)} / ${limitedRows.length}`);
  }

  const header = [
    'exerciseId',
    'name',
    'gifUrl',
    'bodyParts',
    'equipments',
    'targetMuscles',
    'secondaryMuscles',
    'instructions',
  ];
  const rows = [
    header,
    ...translated.map((row) => header.map((key) => row[key] ?? '')),
  ];

  fs.writeFileSync(outputPath, `\uFEFF${stringifyCsv(rows)}\n`, 'utf8');
  console.log(`[translate] wrote ${outputPath}`);
}

main().catch((error) => {
  console.error('[translate] failed', error);
  process.exit(1);
});
