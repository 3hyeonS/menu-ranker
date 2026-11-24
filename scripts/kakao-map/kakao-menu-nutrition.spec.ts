import {
  buildBrandEvaluationTargets,
  buildEstimatePrompt,
  buildMfdsIndex,
  collectMenuNameTargets,
  costUsd,
  estimateRun,
  hasSizeMark,
  latestOkRecords,
  mfdsRecord,
  MfdsMenu,
  parseEstimateRecord,
  parseEstimateResponse,
  parseReferenceMenus,
  ReferenceIndex,
  ReferenceMenu,
  summarizeEvaluation,
  toMfdsMenu,
  EstimateRecord,
} from './kakao-menu-nutrition';

const REFERENCE_HEADER =
  '메뉴,브랜드,브랜드 카테고리,메뉴 카테고리,중량 단위,중량,총중량,단위량,칼로리,탄수화물,당류,당알코올,식이섬유,단백질,지방,포화지방,트랜스지방,불포화지방,나트륨,카페인,칼륨,콜레스테롤,알코올'.split(
    ',',
  );

function referenceRow(values: Record<string, string>): string[] {
  return REFERENCE_HEADER.map((header) => values[header] ?? '');
}

function reference(
  id: number,
  name: string,
  brand: string,
  restaurantCategory: string | null,
  calories = 500,
): ReferenceMenu {
  return {
    id,
    name,
    brand,
    restaurantCategory,
    menuCategory: null,
    unit: 0,
    weight: 300,
    unitQuantity: '1인분',
    nutrition: {
      calories,
      carbs: 50,
      protein: 20,
      fat: 15,
      sugars: null,
      satFat: null,
    },
  };
}

function okRecord(overrides: Partial<EstimateRecord> = {}): EstimateRecord {
  return {
    normalizedName: '김치찌개',
    sampleName: '김치찌개',
    status: 'ok',
    source: 'llm',
    nutrition: {
      calories: 400,
      carbs: 20,
      protein: 25,
      fat: 18,
      sugars: 4,
      satFat: 6,
    },
    unit: 0,
    weight: 450,
    unitQuantity: '인분',
    confidence: 0.8,
    ragConfidence: 0.8,
    path: 'rag',
    model: 'gemini-2.5-flash-lite',
    promptVersion: 'v',
    references: [],
    inputTokens: 300,
    outputTokens: 90,
    error: null,
    estimatedAt: '2026-11-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('collectMenuNameTargets', () => {
  it('groups rows by normalized name and sorts by store count', () => {
    const categories = new Map([
      ['1', '음식점 > 한식 > 찌개,전골'],
      ['2', '음식점 > 한식'],
      ['3', '음식점 > 한식'],
    ]);
    const { targets, rowCount, emptyNameRowCount } = collectMenuNameTargets(
      [
        { placeId: '1', name: '김치찌개' },
        { placeId: '1', name: '김치찌개(대)' },
        { placeId: '2', name: '김치 찌개' },
        { placeId: '3', name: '김치찌개' },
        { placeId: '3', name: '된장찌개' },
        { placeId: '3', name: '★' },
      ],
      categories,
    );

    expect(rowCount).toBe(6);
    expect(emptyNameRowCount).toBe(1);
    expect(targets).toEqual([
      {
        key: '김치찌개',
        sampleName: '김치찌개',
        storeCount: 3,
        rowCount: 4,
        restaurantCategory: '한식',
        sizeMarkedRowCount: 1,
      },
      {
        key: '된장찌개',
        sampleName: '된장찌개',
        storeCount: 1,
        rowCount: 1,
        restaurantCategory: '한식',
        sizeMarkedRowCount: 0,
      },
    ]);
  });
});

describe('hasSizeMark', () => {
  it.each([
    ['물냉면(대)', true],
    ['족발 소', true],
    ['삼겹살 2인분', true],
    ['군만두(8개)', true],
    ['소고기국밥', false],
    ['2인세트', false],
  ])('%s → %s', (name, expected) => {
    expect(hasSizeMark(name)).toBe(expected);
  });
});

describe('parseReferenceMenus', () => {
  it('reads the 23-column CSV and skips rows without calories', () => {
    const menus = parseReferenceMenus([
      REFERENCE_HEADER,
      referenceRow({
        메뉴: '불고기버거',
        브랜드: '롯데리아',
        '브랜드 카테고리': '버거',
        '메뉴 카테고리': '버거',
        '중량 단위': '0',
        중량: '263',
        단위량: '1개',
        칼로리: '572',
        탄수화물: '60',
        당류: '15',
        단백질: '23',
        지방: '25',
        포화지방: '12',
      }),
      referenceRow({ 메뉴: '칼로리 없음', 브랜드: '롯데리아' }),
    ]);

    expect(menus).toEqual([
      {
        id: 1,
        name: '불고기버거',
        brand: '롯데리아',
        restaurantCategory: '버거',
        menuCategory: '버거',
        unit: 0,
        weight: 263,
        unitQuantity: '1개',
        nutrition: {
          calories: 572,
          carbs: 60,
          protein: 23,
          fat: 25,
          sugars: 15,
          satFat: 12,
        },
      },
    ]);
  });

  it('fails when a required column is missing', () => {
    expect(() => parseReferenceMenus([['메뉴', '브랜드']])).toThrow(
      '근거 메뉴 CSV에 열이 없습니다',
    );
  });
});

describe('ReferenceIndex', () => {
  const index = new ReferenceIndex([
    reference(1, '김치찌개', '한솥', '도시락'),
    reference(2, '참치김치찌개', '김밥천국', '분식'),
    reference(3, '불고기버거', '롯데리아', '버거'),
    reference(4, '김치볶음밥', '한솥', '도시락'),
  ]);

  it('ranks by bigram similarity with a restaurant category bonus', () => {
    const matches = index.search('김치찌개', '분식');

    expect(matches.map((match) => match.menu.id)).toEqual([1, 2, 4]);
    expect(matches[0].score).toBeCloseTo(1);
    // 참치김치찌개: 공통 bigram 3 / (3 + 5 - 3) = 0.6, 분식 카테고리 +0.08
    expect(matches[1].score).toBeCloseTo(0.68);
  });

  it('excludes a brand and limits the result size', () => {
    const matches = index.search('김치찌개', null, {
      excludeBrand: '한솥',
      limit: 1,
    });

    expect(matches.map((match) => match.menu.id)).toEqual([2]);
  });

  it('returns nothing without any shared bigram', () => {
    expect(index.search('아메리카노', null)).toEqual([]);
  });
});

describe('mfds index', () => {
  const menu = (id: number, name: string, calories = 300): MfdsMenu => ({
    id,
    name,
    unit: 0,
    weight: 400,
    unitQuantity: '인분',
    nutrition: {
      calories,
      carbs: 10,
      protein: 20,
      fat: 15,
      sugars: 2,
      satFat: 5,
    },
  });

  it('prefers the plain name over a bracketed variant with the same key', () => {
    const index = buildMfdsIndex([
      menu(1, '(식약처_음식) 김치찌개(돼지고기)', 350),
      menu(2, '(식약처_음식) 김치찌개', 300),
      menu(3, '(식약처_음식) 김치찌개(참치)', 320),
    ]);

    expect(index.get('김치찌개').id).toBe(2);
  });

  it('converts DB rows and skips rows without calories', () => {
    expect(
      toMfdsMenu({
        id: 7,
        name: '(식약처_음식) 가래떡',
        unit: 0,
        weight: 100,
        unit_quantity: '인분',
        calories: 195,
        carbs: 43.7,
        protein: 3.9,
        fat: 0.5,
        sugars: null,
        sat_fat: 0.2,
      }),
    ).toEqual({
      id: 7,
      name: '(식약처_음식) 가래떡',
      unit: 0,
      weight: 100,
      unitQuantity: '인분',
      nutrition: {
        calories: 195,
        carbs: 43.7,
        protein: 3.9,
        fat: 0.5,
        sugars: null,
        satFat: 0.2,
      },
    });
    expect(toMfdsMenu({ id: 8, name: 'x', calories: null })).toBeNull();
  });

  it('builds an mfds record without LLM fields', () => {
    const record = mfdsRecord(
      { key: '김치찌개', sampleName: '김치찌개', storeCount: 3, rowCount: 4 },
      menu(2, '(식약처_음식) 김치찌개'),
      new Date('2026-11-24T00:00:00Z'),
    );

    expect(record).toMatchObject({
      normalizedName: '김치찌개',
      status: 'ok',
      source: 'mfds',
      confidence: 1,
      path: null,
      model: null,
      references: [{ menu_id: 2, name: '(식약처_음식) 김치찌개' }],
      inputTokens: 0,
      weight: 400,
    });
    expect(parseEstimateRecord(record)).not.toBeNull();
  });
});

describe('buildEstimatePrompt', () => {
  const items = [
    {
      id: '1',
      name: '김치찌개',
      restaurantCategory: '한식',
      references: [{ menu: reference(1, '김치찌개', '한솥', null), score: 1 }],
    },
  ];

  it('sends only menu attributes and reference nutrition for RAG', () => {
    const prompt = buildEstimatePrompt(items, 'rag');

    expect(prompt).toContain('"referenceMenus":[{"name":"김치찌개"');
    expect(prompt).toContain('"nutrition":{"calories":500');
    // null 값과 내부 키는 보내지 않는다.
    expect(prompt).not.toContain('null');
    expect(prompt).not.toContain('placeId');
  });

  it('omits references for the LLM-only prompt', () => {
    const prompt = buildEstimatePrompt(items, 'llm_only');

    expect(prompt).not.toContain('referenceMenus');
    expect(prompt).toContain(
      '"menu":{"name":"김치찌개","restaurantCategory":"한식"}',
    );
  });
});

describe('parseEstimateResponse', () => {
  it('keeps only valid items for the requested ids', () => {
    const values = parseEstimateResponse(
      [
        {
          id: '1',
          calories: '512.34',
          carbs: 60,
          protein: 20,
          fat: 18,
          sugars: 5,
          satFat: 6,
          weightG: 450,
          confidence: 0.8123,
        },
        {
          id: '2',
          calories: null,
          carbs: 1,
          protein: 1,
          fat: 1,
          sugars: 1,
          satFat: 1,
          confidence: 0.9,
        },
        {
          id: '3',
          calories: 9000,
          carbs: 1,
          protein: 1,
          fat: 1,
          sugars: 1,
          satFat: 1,
          confidence: 0.9,
        },
        {
          id: '4',
          calories: 100,
          carbs: 1,
          protein: 1,
          fat: 1,
          sugars: 1,
          satFat: 1,
          confidence: 1.5,
        },
        {
          id: '9',
          calories: 100,
          carbs: 1,
          protein: 1,
          fat: 1,
          sugars: 1,
          satFat: 1,
          confidence: 0.5,
        },
      ],
      ['1', '2', '3', '4'],
    );

    expect([...values.keys()]).toEqual(['1']);
    expect(values.get('1')).toEqual({
      nutrition: {
        calories: 512.3,
        carbs: 60,
        protein: 20,
        fat: 18,
        sugars: 5,
        satFat: 6,
      },
      weight: 450,
      confidence: 0.812,
    });
  });

  it('returns nothing for a non-array response', () => {
    expect(parseEstimateResponse({ id: '1' }, ['1']).size).toBe(0);
  });
});

describe('latestOkRecords', () => {
  it('lets the last ok record win and counts names that only failed', () => {
    const failed = okRecord({
      normalizedName: '된장찌개',
      status: 'failed',
      nutrition: null,
    });
    const { records, failedOnlyCount } = latestOkRecords([
      okRecord({ confidence: 0.5 }),
      okRecord({ normalizedName: '라면', status: 'failed', nutrition: null }),
      okRecord({ normalizedName: '라면' }),
      okRecord({ confidence: 0.9 }),
      failed,
    ]);

    expect(
      records.map((record) => [record.normalizedName, record.confidence]),
    ).toEqual([
      ['김치찌개', 0.9],
      ['라면', 0.8],
    ]);
    expect(failedOnlyCount).toBe(1);
  });

  it('rejects malformed JSONL lines', () => {
    expect(parseEstimateRecord({ normalizedName: 'x' })).toBeNull();
    expect(parseEstimateRecord(okRecord({ nutrition: null }))).toBeNull();
    expect(
      parseEstimateRecord(okRecord({ status: 'failed', nutrition: null })),
    ).not.toBeNull();
  });
});

describe('estimateRun', () => {
  it('counts RAG and LLM-only requests and the cost range', () => {
    const index = new ReferenceIndex([reference(1, '김치찌개', '한솥', null)]);
    const targets = [
      { sampleName: '김치찌개', restaurantCategory: '한식' },
      { sampleName: '아메리카노', restaurantCategory: '카페' },
    ];

    const withFallback = estimateRun(targets, index, {
      batchSize: 10,
      concurrency: 5,
      rpm: 60,
      fallbackThreshold: 0.7,
      prices: { input: 0.1, output: 0.4 },
    });
    const withoutFallback = estimateRun(targets, index, {
      batchSize: 10,
      concurrency: 5,
      rpm: 60,
      fallbackThreshold: 0,
      prices: { input: 0.1, output: 0.4 },
    });

    expect(withFallback).toMatchObject({
      llmMenuCount: 2,
      referencelessMenuCount: 1,
      ragRequestCount: 1,
      llmOnlyRequestCount: 1,
    });
    // 재추정을 끄면 근거 없는 메뉴만 순수 LLM으로 간다.
    expect(withoutFallback.llmOnlyMenuCount).toBe(1);
    expect(withFallback.inputTokens).toBeGreaterThan(
      withoutFallback.inputTokens,
    );
    expect(withFallback.costUsd).toBeGreaterThanOrEqual(
      withFallback.minimumCostUsd,
    );
  });

  it('computes cost from per-million prices', () => {
    expect(
      costUsd(1_000_000, 500_000, { input: 0.1, output: 0.4 }),
    ).toBeCloseTo(0.3);
  });
});

describe('buildBrandEvaluationTargets', () => {
  it('matches kakao menus of brand branches to the same brand official menu and interleaves brands', () => {
    const references = [
      reference(1, '허니콤보', '교촌치킨', '치킨', 1800),
      reference(2, '레드콤보', '교촌치킨', '치킨', 1900),
      reference(3, '불고기버거', '롯데리아', '버거', 572),
      reference(4, '허니콤보', '다른브랜드', '치킨', 1000),
    ];
    const targets = buildBrandEvaluationTargets(
      [
        { placeId: '1', name: '허니콤보', brand: '교촌치킨' },
        { placeId: '2', name: '허니 콤보', brand: '교촌치킨' },
        { placeId: '1', name: '레드콤보(L)', brand: '교촌치킨' },
        { placeId: '3', name: '불고기버거', brand: '롯데리아' },
        { placeId: '3', name: '없는메뉴', brand: '롯데리아' },
      ],
      references,
      new Map(),
    );

    expect(
      targets.map((target) => [
        target.brand,
        target.key,
        target.truth.calories,
      ]),
    ).toEqual([
      ['교촌치킨', '허니콤보', 1800],
      ['롯데리아', '불고기버거', 572],
      ['교촌치킨', '레드콤보', 1900],
    ]);
  });
});

describe('summarizeEvaluation', () => {
  it('reports held rate and errors for shown and all valid estimates', () => {
    const truth = {
      calories: 500,
      carbs: 50,
      protein: 20,
      fat: null,
      sugars: null,
      satFat: null,
    };
    const summary = summarizeEvaluation(
      [
        {
          truth,
          record: okRecord({
            confidence: 0.9,
            nutrition: {
              calories: 550,
              carbs: 50,
              protein: 30,
              fat: 10,
              sugars: 1,
              satFat: 1,
            },
          }),
        },
        {
          truth,
          record: okRecord({
            confidence: 0.4,
            path: 'llm_only',
            nutrition: {
              calories: 900,
              carbs: 50,
              protein: 20,
              fat: 10,
              sugars: 1,
              satFat: 1,
            },
          }),
        },
        { truth, record: okRecord({ status: 'failed', nutrition: null }) },
      ],
      0.6,
    );

    expect(summary).toMatchObject({
      count: 3,
      failedCount: 1,
      lowConfidenceCount: 1,
      heldRate: 0.6667,
      byPath: { rag: 1, llm_only: 1 },
    });
    expect(summary.shown.calories).toEqual({
      evaluated: 1,
      mae: 50,
      within30Percent: 1,
    });
    expect(summary.allValid.calories).toEqual({
      evaluated: 2,
      mae: 225,
      within30Percent: 0.5,
    });
    // 정답이 없는 영양소는 평가하지 않는다.
    expect(summary.shown.fat.evaluated).toBe(0);
  });
});
