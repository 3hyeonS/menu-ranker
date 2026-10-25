// Mifflin-St Jeor 기초대사량(kcal). gender 1(여성)은 남성식에서 166을 뺀다(-161 - 5).
// 나이 계산(기준 연도)은 호출부마다 달라 인자로 받는다. 반올림하지 않은 값을 돌려준다.
export function calculateMifflinStJeorBmr(params: {
  weight: number;
  height: number;
  age: number;
  gender: number;
}): number {
  let bmr = 10 * params.weight + 6.25 * params.height - 5 * params.age + 5;
  if (params.gender === 1) {
    bmr -= 166;
  }

  return bmr;
}
