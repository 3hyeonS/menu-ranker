import { MenuRow } from './benchmark-restaurant-nutrition';
import {
  embeddingKey,
  promptFor,
} from './benchmark-restaurant-nutrition-llm';

const targetTruthSentinels = [987654.1, 987654.2, 987654.3, 987654.4];

function menu(
  id: string,
  name: string,
  nutrients: MenuRow['nutrients'],
): MenuRow {
  return {
    id,
    name,
    brand: '테스트브랜드',
    restaurantCategory: '테스트카테고리',
    menuCategory: '테스트메뉴분류',
    weight: 123,
    nutrients,
    tokens: new Set(),
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  const target = menu('target-id', '목표메뉴', {
    calories: targetTruthSentinels[0],
    carbs: targetTruthSentinels[1],
    protein: targetTruthSentinels[2],
    fat: targetTruthSentinels[3],
  });
  const reference = menu('reference-id', '근거메뉴', {
    calories: 321,
    carbs: 42,
    protein: 12,
    fat: 9,
  });
  const forbiddenKeys = [
    'userId',
    'email',
    'phone',
    'mealRecords',
    'workoutRecords',
    'menstrualCycle',
    'birthDate',
    'address',
  ];

  for (const method of ['llm_only', 'hybrid_rag'] as const) {
    const vector = Array.from({ length: 128 }, (_, index) =>
      index === 0 ? 1 : 0,
    );
    const prompt = promptFor([target], method, [reference], {
      [embeddingKey(target)]: vector,
      [embeddingKey(reference)]: vector,
    });
    assert(prompt.includes('목표메뉴'), `${method}: 목표 메뉴명이 누락됐습니다.`);
    assert(prompt.includes('테스트브랜드'), `${method}: 브랜드가 누락됐습니다.`);
    for (const sentinel of targetTruthSentinels) {
      assert(
        !prompt.includes(String(sentinel)),
        `${method}: 목표 메뉴의 정답 영양정보가 프롬프트에 포함됐습니다.`,
      );
    }
    for (const key of forbiddenKeys) {
      assert(
        !prompt.includes(key),
        `${method}: 금지된 사용자 필드 ${key}가 프롬프트에 포함됐습니다.`,
      );
    }
    if (method === 'llm_only') {
      assert(!prompt.includes('근거메뉴'), '순수 LLM 프롬프트에 근거 메뉴가 포함됐습니다.');
    } else {
      assert(prompt.includes('근거메뉴'), 'RAG 프롬프트에 근거 메뉴가 없습니다.');
      for (const value of [321, 42, 12, 9]) {
        assert(prompt.includes(String(value)), `RAG 근거 영양값 ${value}가 누락됐습니다.`);
      }
    }
  }
  for (const method of ['llm_only', 'hybrid_rag'] as const) {
    const vector = Array.from({ length: 128 }, (_, index) =>
      index === 0 ? 1 : 0,
    );
    const prompt = promptFor(
      [target],
      method,
      [reference],
      {
        [embeddingKey(target, 'name')]: vector,
        [embeddingKey(reference, 'name')]: vector,
      },
      'name_only',
    );
    for (const forbiddenValue of [
      target.brand,
      target.restaurantCategory,
      target.menuCategory,
      String(target.weight),
    ]) {
      assert(
        !prompt.includes(forbiddenValue),
        `${method}: 메뉴명 전용 프롬프트에 추가 입력 ${forbiddenValue}가 포함됐습니다.`,
      );
    }
  }
  console.log('[NUTRITION_PROMPT_AUDIT] passed', {
    targetNutritionHidden: true,
    userFieldsExcluded: true,
    ragReferenceNutritionIncluded: true,
    nameOnlyProfileRestricted: true,
  });
}

main();
