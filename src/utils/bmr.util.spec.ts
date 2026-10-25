import { calculateMifflinStJeorBmr } from './bmr.util';
import { roundToOneDecimal } from './number.util';
import { AuthService } from '../auth/auth.service';
import { HomeService } from '../home/home.service';
import { ChatService } from '../chat/chat.service';

// 통합 전 세 곳에 있던 계산식을 그대로 옮겨 둔 기준 구현
const legacyAuthBmr = (
  weight: number,
  height: number,
  age: number,
  gender: number,
) => {
  let bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  if (gender == 1) {
    bmr -= 166;
  }
  return bmr;
};
const legacyHomeChatBmr = (userInfo: any, age: number) => {
  let bmr =
    10 * Number(userInfo.weight) + 6.25 * Number(userInfo.height) - 5 * age + 5;
  if (userInfo.gender === 1) {
    bmr -= 166;
  }
  return roundToOneDecimal(bmr);
};

const weights = [0, 38.7, 45, 52.3, 61.2, 64.3, 72.9, 88.8, 120.1, 180.5];
const heights = [0, 140.3, 152.5, 160, 165.7, 170.1, 181.9, 199.9];
const ages = [-1, 0, 17, 25, 30, 44, 61, 99];
const genders = [0, 1];

const forEachInput = (
  callback: (w: number, h: number, a: number, g: number) => void,
) =>
  weights.forEach((w) =>
    heights.forEach((h) =>
      ages.forEach((a) => genders.forEach((g) => callback(w, h, a, g))),
    ),
  );

describe('calculateMifflinStJeorBmr', () => {
  it('returns known values', () => {
    expect(
      calculateMifflinStJeorBmr({
        weight: 65,
        height: 170,
        age: 30,
        gender: 0,
      }),
    ).toBe(1567.5);
    expect(
      calculateMifflinStJeorBmr({
        weight: 65,
        height: 170,
        age: 30,
        gender: 1,
      }),
    ).toBe(1401.5);
  });

  it('matches the legacy formula bit for bit', () => {
    forEachInput((weight, height, age, gender) => {
      expect(
        Object.is(
          calculateMifflinStJeorBmr({ weight, height, age, gender }),
          legacyAuthBmr(weight, height, age, gender),
        ),
      ).toBe(true);
    });
  });

  it('keeps HomeService and ChatService BMR results identical to the legacy code', () => {
    const home = Object.create(HomeService.prototype) as any;
    const chat = Object.create(ChatService.prototype) as any;

    forEachInput((weight, height, age, gender) => {
      // DB decimal 컬럼처럼 문자열로 들어오는 경우도 확인한다.
      const userInfo = {
        weight: String(weight),
        height: String(height),
        gender,
        birthYear: 2026 - age - 1,
      };
      const expected = legacyHomeChatBmr(userInfo, age);

      expect(
        Object.is(
          home.calculateBasalMetabolicRate(userInfo, new Date(2026, 5, 15)),
          expected,
        ),
      ).toBe(true);
      expect(
        Object.is(
          chat.calculateManagementPatternBmr(userInfo, '2026-06-15'),
          expected,
        ),
      ).toBe(true);
    });
  });

  it('keeps AuthService default target calories identical to the legacy code', async () => {
    const auth = Object.create(AuthService.prototype) as AuthService;
    const year = new Date().getFullYear();
    const legacyTarget = (dto: any) => {
      const age = year - dto.birthYear - 1;
      const bmr = legacyAuthBmr(dto.weight, dto.height, age, dto.gender);
      const TDEE = bmr * (1.2 + 0.175 * dto.activity);
      let goal = TDEE;
      if (dto.target_weight !== dto.weight) {
        switch (dto.goal) {
          case 0:
            goal = dto.target_weight > dto.weight ? TDEE + 200 : TDEE - 500;
            break;
          case 2:
            goal = dto.target_weight < dto.weight ? TDEE - 300 : TDEE + 300;
            break;
        }
      }
      return roundToOneDecimal(Math.max(bmr, goal));
    };

    for (const weight of weights.slice(1)) {
      for (const height of heights.slice(1)) {
        for (const gender of genders) {
          for (const activity of [0, 1, 2, 3, 4]) {
            for (const goal of [0, 1, 2]) {
              for (const targetWeight of [weight - 5.5, weight, weight + 3.2]) {
                const dto = {
                  gender,
                  birthYear: 1990,
                  height,
                  weight,
                  activity,
                  goal,
                  target_weight: targetWeight,
                };
                expect(
                  Object.is(
                    await auth.defaltTargetCalories(dto as any),
                    legacyTarget(dto),
                  ),
                ).toBe(true);
              }
            }
          }
        }
      }
    }
  });
});
