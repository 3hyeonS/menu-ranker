import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealMenuEntity } from '../home/entity/meal-menu.entity';
import { MenuVectorService } from '../vector/menu-vector.service';
import {
  preferUserFoodImageMenu,
  prioritizeUserFoodImageMenus,
} from '../utils/food-image-menu-priority.util';
import {
  calculateFoodImageCandidateScore,
  FOOD_IMAGE_REMATCH_PROMPT_RULES,
  FOOD_IMAGE_STRICT_DISH_TYPE_TOKENS,
  isFoodImageBrandMatch,
} from '../utils/food-image-recognition.util';
import { getFrequentlyRecordedMenuIds } from '../utils/frequent-menu.util';
import { mapWithConcurrency } from '../utils/concurrency.util';
import {
  findPreferredGenericFoodImageCandidate,
  isGenericPlainSaltName,
  isGenericSweetPotatoCandidateCompatible,
  isPreferredGenericFriedEggMenu,
  isPreferredGenericPlainRiceMenu,
  isPreferredGenericRefinedSaltMenu,
  isPreferredGenericSweetPotatoMenu,
  PREFERRED_REFINED_SALT_MENU_ID,
  prioritizeGenericFoodImageCandidate,
  stripPublicMenuSourcePrefix,
} from '../utils/menu-name.util';
import {
  isRequestCancellationError,
  throwIfRequestAborted,
} from '../utils/request-abort.util';
import { FoodImageMenuCatalog } from './food-image-menu-catalog';
import {
  FoodImageCandidateGroup,
  FoodImageMatchPrediction,
  FoodImageMenuCandidate,
  FoodImageMenuMatch,
  FoodImageTimingLogger,
} from './food-image.types';
import {
  normalizeCompactFoodImageText,
  parseNullableNumber,
} from './food-image.util';

export type FoodImageMenuMatchParams = {
  userId: number;
  predictions: FoodImageMatchPrediction[];
  // 공용 + 내 개인 메뉴. 보통 FoodImageMenuCatalog.getCandidateMenus(userId) 결과다.
  menus: FoodImageMenuCandidate[];
  // 사진과 rematch 프롬프트를 Gemini에 보내 JSON을 받는다. 호출부의 Gemini 설정을 그대로 쓴다.
  requestRematchJson: (prompt: string) => Promise<any>;
  logPrefix: string;
  timing?: FoodImageTimingLogger;
};

const LOCAL_CANDIDATE_MIN_SCORE = 32;
const LOCAL_FALLBACK_MIN_SCORE = 55;

// 음식 사진 1차 인식 결과(음식별 이름·브랜드·양)를 DB 메뉴에 매칭한다(home·chat 공용).
// 후보 수집(정확한 제품명, 브랜드, 일반 선호 메뉴, 개인·자주 먹은 메뉴, 벡터 또는 로컬 점수)
// → 사진과 후보로 Gemini rematch → 누락분 로컬 보충 → 같은 메뉴 중복 제거 순서다.
@Injectable()
export class FoodImageMenuMatcher {
  constructor(
    private readonly menuCatalog: FoodImageMenuCatalog,
    @InjectRepository(MealMenuEntity)
    private readonly mealMenuRepository: Repository<MealMenuEntity>,
    @Optional()
    private readonly menuVectorService?: MenuVectorService,
  ) {}

  async match(params: FoodImageMenuMatchParams): Promise<FoodImageMenuMatch[]> {
    const { predictions, menus, timing } = params;
    const candidateGroups = await this.buildCandidateGroups(params);
    throwIfRequestAborted();
    this.logCandidateGroups(params.logPrefix, candidateGroups);
    const rematchCandidatePool = this.mergeCandidatesById(
      candidateGroups.flatMap((group) => group.candidates),
    );
    timing?.mark('food_image_candidate_groups_selected', {
      groupCount: candidateGroups.length,
      candidateCount: rematchCandidatePool.length,
      perFoodLimit: this.getPerFoodCandidateLimit(),
    });
    const rematchedFoods = await this.rematchWithGemini(
      params,
      candidateGroups,
    );
    throwIfRequestAborted();
    timing?.mark('food_image_gemini_rematch_completed', {
      rematchedCount: rematchedFoods.length,
    });
    const recognizedFoods = this.mergeRematchesWithLocalFallback(
      predictions,
      candidateGroups,
      menus,
      rematchedFoods,
    );
    const localFallbackCount = Math.max(
      recognizedFoods.length - rematchedFoods.length,
      0,
    );
    timing?.mark('food_image_final_match_selected', {
      recognizedFoodCount: recognizedFoods.length,
      rematchedCount: rematchedFoods.length,
      localFallbackCount,
      source:
        rematchedFoods.length === 0
          ? 'local'
          : localFallbackCount > 0
            ? 'gemini_rematch_with_local_fallback'
            : 'gemini_rematch',
    });

    return this.deduplicateMatches(recognizedFoods);
  }

  private async buildCandidateGroups({
    userId,
    predictions,
    menus: loadedMenus,
    logPrefix,
    timing,
  }: FoodImageMenuMatchParams): Promise<FoodImageCandidateGroup[]> {
    const frequentMenuIds = await getFrequentlyRecordedMenuIds(
      this.mealMenuRepository,
      userId,
    );
    const frequentRanks = new Map(
      frequentMenuIds.map((id, index) => [id, index + 1]),
    );
    // 자주 먹은 메뉴만 복사해 순위를 붙이고, 나머지는 캐시 원소를 그대로 쓴다.
    const menus = loadedMenus.map((menu) =>
      frequentRanks.has(menu.id)
        ? { ...menu, frequentRank: frequentRanks.get(menu.id) }
        : menu,
    );
    const frequentMenus = menus.filter(
      (menu) => menu.frequentRank !== undefined,
    );
    const perFoodLimit = this.getPerFoodCandidateLimit();
    const predictionEntries = predictions.map((prediction, index) => ({
      prediction,
      index,
    }));
    const personalGroupMap = new Map(
      this.getLocalCandidateGroups(
        predictionEntries,
        menus.filter((menu) => menu.ownerUserId != null),
      ).map((group) => [group.foodIndex, group]),
    );
    const frequentGroupMap = new Map(
      this.getLocalCandidateGroups(predictionEntries, frequentMenus).map(
        (group) => [group.foodIndex, group],
      ),
    );
    const preferredRefinedSaltMenus = predictions.some(
      (prediction) =>
        !prediction.brand && isGenericPlainSaltName(prediction.foodName),
    )
      ? await this.menuCatalog.getMenusByIds(userId, [
          PREFERRED_REFINED_SALT_MENU_ID,
        ])
      : [];
    const groups = await this.getVectorCandidateGroups(
      userId,
      predictions,
      logPrefix,
      timing,
    );
    const groupMap = new Map(groups.map((group) => [group.foodIndex, group]));
    const missingPredictions = predictionEntries.filter(
      ({ index }) => !groupMap.has(index),
    );

    if (missingPredictions.length > 0) {
      const localGroups = this.getLocalCandidateGroups(
        missingPredictions,
        menus,
      );
      localGroups.forEach((group) => groupMap.set(group.foodIndex, group));
      timing?.mark('food_image_local_candidate_groups_completed', {
        groupCount: localGroups.length,
      });
    }
    // 벡터 후보를 전체 목록의 같은 메뉴(자주 먹은 순위 포함)로 바꾸기 위한 조회표.
    // 전체 메뉴로 Map을 만들면 요청마다 수십만 항목이 생기므로 필요한 id만 담는다.
    const groupCandidateIds = new Set(
      Array.from(groupMap.values()).flatMap((group) =>
        group.candidates.map((candidate) => candidate.id),
      ),
    );
    const menuById = new Map(
      menus
        .filter((menu) => groupCandidateIds.has(menu.id))
        .map((menu) => [menu.id, menu]),
    );

    return predictions
      .map((prediction, index) => {
        const group = groupMap.get(index) ?? {
          foodIndex: index,
          foodName: prediction.foodName,
          candidates: [],
        };
        const brandMenus = prediction.brand
          ? this.findBrandCandidates(prediction, menus, perFoodLimit)
          : [];
        const exactProductMenus = this.findExactProductCandidates(
          prediction,
          menus,
          perFoodLimit,
        );
        // 전체 목록을 복사하지 않도록 정제염 후보와 전체 목록을 따로 거른다(순서는 같다).
        const isPreferredGenericMenu = (menu: FoodImageMenuCandidate) =>
          isPreferredGenericFriedEggMenu(prediction.foodName, menu.name) ||
          isPreferredGenericPlainRiceMenu(prediction.foodName, menu.name) ||
          isPreferredGenericSweetPotatoMenu(prediction.foodName, menu.name) ||
          isPreferredGenericRefinedSaltMenu(prediction.foodName, menu);
        const preferredMenus = prediction.brand
          ? []
          : [
              ...preferredRefinedSaltMenus.filter(isPreferredGenericMenu),
              ...menus.filter(isPreferredGenericMenu),
            ];

        const candidates = prioritizeGenericFoodImageCandidate(
          prediction.foodName,
          this.mergeCandidatesById([
            ...exactProductMenus,
            ...brandMenus,
            ...preferredMenus,
            ...(personalGroupMap.get(index)?.candidates ?? []),
            ...(frequentGroupMap.get(index)?.candidates ?? []),
            ...group.candidates.map((menu) => menuById.get(menu.id) ?? menu),
          ]).filter((candidate) =>
            this.isDishTypeCompatible(prediction.foodName, candidate),
          ),
        );
        const prioritizedCandidates = prioritizeUserFoodImageMenus(
          candidates,
        ).slice(0, perFoodLimit);
        const exactPreferredCandidate = exactProductMenus.find((menu) =>
          prioritizedCandidates.some((candidate) => candidate.id === menu.id),
        );

        return {
          ...group,
          ...(exactPreferredCandidate
            ? { preferredCandidateId: exactPreferredCandidate.id }
            : {}),
          candidates: prioritizedCandidates,
        };
      })
      .filter((group) => group.candidates.length > 0);
  }

  private findExactProductCandidates(
    prediction: FoodImageMatchPrediction,
    menus: FoodImageMenuCandidate[],
    limit: number,
  ): FoodImageMenuCandidate[] {
    if (!prediction.productName) {
      return [];
    }

    const productName = normalizeCompactFoodImageText(prediction.productName);
    const recognizedBrand = normalizeCompactFoodImageText(
      prediction.brand ?? '',
    );
    const getBrandRank = (menu: FoodImageMenuCandidate): number => {
      const candidateBrand = normalizeCompactFoodImageText(menu.brand ?? '');

      if (!recognizedBrand || !candidateBrand) {
        return 0;
      }
      if (recognizedBrand === candidateBrand) {
        return 2;
      }

      return recognizedBrand.includes(candidateBrand) ||
        candidateBrand.includes(recognizedBrand)
        ? 1
        : 0;
    };

    return menus
      .filter(
        (menu) =>
          normalizeCompactFoodImageText(
            stripPublicMenuSourcePrefix(menu.name),
          ) === productName,
      )
      .sort((left, right) => {
        const brandRankDifference = getBrandRank(right) - getBrandRank(left);
        if (brandRankDifference !== 0) {
          return brandRankDifference;
        }

        const leftLength = normalizeCompactFoodImageText(
          stripPublicMenuSourcePrefix(left.name),
        ).length;
        const rightLength = normalizeCompactFoodImageText(
          stripPublicMenuSourcePrefix(right.name),
        ).length;

        return rightLength - leftLength || left.id - right.id;
      })
      .slice(0, limit);
  }

  private findBrandCandidates(
    prediction: FoodImageMatchPrediction,
    menus: FoodImageMenuCandidate[],
    limit: number,
  ): FoodImageMenuCandidate[] {
    const brand = prediction.brand ?? '';

    if (!brand) {
      return [];
    }

    const compactBrand = normalizeCompactFoodImageText(brand);

    return menus
      .filter((menu) => {
        const compactMenuName = normalizeCompactFoodImageText(
          stripPublicMenuSourcePrefix(menu.name),
        );

        return (
          isFoodImageBrandMatch(brand, menu.brand ?? '') ||
          compactMenuName.startsWith(compactBrand)
        );
      })
      .map((menu) => ({
        menu,
        score: calculateFoodImageCandidateScore(
          prediction.foodName,
          menu,
          prediction.brand,
          null,
        ),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ menu }) => menu);
  }

  // 음식마다 벡터 검색한다. 하나라도 실패하면 전체를 버리고 로컬 후보로 대체한다.
  private async getVectorCandidateGroups(
    userId: number,
    predictions: FoodImageMatchPrediction[],
    logPrefix: string,
    timing?: FoodImageTimingLogger,
  ): Promise<FoodImageCandidateGroup[]> {
    if (!this.isVectorSearchEnabled() || !this.menuVectorService) {
      timing?.mark('food_image_one_to_one_vector_groups_skipped', {
        predictionCount: predictions.length,
      });
      return [];
    }

    const menuVectorService = this.menuVectorService;
    const perFoodLimit = this.getPerFoodCandidateLimit();

    try {
      const groups = await mapWithConcurrency(
        predictions.map((prediction, index) => ({ prediction, index })),
        this.getVectorMatchConcurrency(),
        async ({ prediction, index }) => {
          const vectorResults = await menuVectorService.searchMenusByText(
            this.buildVectorQuery(prediction),
            {
              userId,
              limit: perFoodLimit,
            },
          );
          const candidates = await this.menuCatalog.getMenusByIds(
            userId,
            vectorResults.map((result) => result.menuId),
          );
          const compatibleCandidates = this.mergeCandidatesById(
            candidates,
          ).filter((candidate) =>
            this.isDishTypeCompatible(prediction.foodName, candidate),
          );

          return {
            foodIndex: index,
            foodName: prediction.foodName,
            candidates: compatibleCandidates.slice(0, perFoodLimit),
          };
        },
      );
      const nonEmptyGroups = groups.filter(
        (group) => group.candidates.length > 0,
      );
      timing?.mark('food_image_one_to_one_vector_groups_completed', {
        predictionCount: predictions.length,
        groupCount: nonEmptyGroups.length,
        perFoodLimit,
      });

      return nonEmptyGroups;
    } catch (error) {
      console.warn(`${logPrefix} food image one-to-one vector groups failed`, {
        message: error instanceof Error ? error.message : String(error),
      });
      timing?.mark('food_image_one_to_one_vector_groups_failed', {
        predictionCount: predictions.length,
      });

      return [];
    }
  }

  private getLocalCandidateGroups(
    predictionEntries: Array<{
      prediction: FoodImageMatchPrediction;
      index: number;
    }>,
    menus: FoodImageMenuCandidate[],
  ): FoodImageCandidateGroup[] {
    const perFoodLimit = this.getPerFoodCandidateLimit();

    return predictionEntries
      .map(({ prediction, index }) => ({
        foodIndex: index,
        foodName: prediction.foodName,
        candidates: this.findTopCandidates(
          prediction,
          menus,
          perFoodLimit,
          LOCAL_CANDIDATE_MIN_SCORE,
        ).filter((candidate) =>
          this.isDishTypeCompatible(prediction.foodName, candidate),
        ),
      }))
      .filter((group) => group.candidates.length > 0);
  }

  private findTopCandidates(
    prediction: FoodImageMatchPrediction,
    menus: FoodImageMenuCandidate[],
    limit: number,
    minScore: number,
  ): FoodImageMenuCandidate[] {
    return menus
      .map((menu) => ({
        menu,
        score: calculateFoodImageCandidateScore(
          prediction.foodName,
          menu,
          prediction.brand,
          null,
        ),
      }))
      .filter(({ score }) => score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ menu }) => menu);
  }

  private findBestCandidate(
    prediction: FoodImageMatchPrediction,
    menus: FoodImageMenuCandidate[],
    minScore: number,
  ): FoodImageMenuCandidate | null {
    const [bestMatch] = menus
      .map((menu) => ({
        menu,
        score: calculateFoodImageCandidateScore(
          prediction.foodName,
          menu,
          prediction.brand,
          null,
        ),
      }))
      .sort((a, b) => b.score - a.score);

    return bestMatch && bestMatch.score >= minScore ? bestMatch.menu : null;
  }

  private buildVectorQuery(prediction: FoodImageMatchPrediction): string {
    const brandLine = prediction.brand
      ? `이미지에서 읽힌 브랜드/라벨: ${prediction.brand}`
      : '이미지에서 읽힌 브랜드/라벨: 없음';
    const productLine = prediction.productName
      ? `이미지에서 읽힌 정확한 제품명: ${prediction.productName}`
      : '이미지에서 읽힌 정확한 제품명: 없음';
    const searchIntent = prediction.brand
      ? `${prediction.brand} ${prediction.productName ?? prediction.foodName}`
      : prediction.foodName;
    const strictDishType = this.getStrictDishTypeToken(prediction.foodName);

    return [
      `음식 사진에서 인식된 음식명: ${prediction.foodName}`,
      productLine,
      brandLine,
      `검색 의도: ${searchIntent}`,
      strictDishType
        ? `반드시 보존해야 하는 음식 형태: ${strictDishType}`
        : '음식 형태가 명확하지 않으면 음식명 의미가 가장 가까운 메뉴를 찾는다.',
      prediction.brand
        ? '브랜드가 확실히 읽힌 경우 같은 브랜드의 DB 메뉴를 우선한다.'
        : '브랜드가 없으면 음식명/의미가 가장 가까운 DB 메뉴를 찾는다.',
      '가공식품명보다 실제 음식명과 같은 메뉴를 우선하되, 포장/라벨 브랜드가 보이면 해당 브랜드 제품을 우선한다.',
    ].join('\n');
  }

  private getStrictDishTypeToken(foodName: string): string | null {
    const compactFoodName = normalizeCompactFoodImageText(foodName);

    return (
      FOOD_IMAGE_STRICT_DISH_TYPE_TOKENS.find((token) =>
        compactFoodName.includes(token),
      ) ?? null
    );
  }

  private isDishTypeCompatible(
    foodName: string,
    menu: FoodImageMenuCandidate,
  ): boolean {
    if (!isGenericSweetPotatoCandidateCompatible(foodName, menu.name)) {
      return false;
    }

    const requiredDishType = this.getStrictDishTypeToken(foodName);

    if (!requiredDishType) {
      return true;
    }

    return (
      normalizeCompactFoodImageText(menu.name).includes(requiredDishType) ||
      normalizeCompactFoodImageText(menu.category ?? '').includes(
        requiredDishType,
      )
    );
  }

  private logCandidateGroups(
    logPrefix: string,
    candidateGroups: FoodImageCandidateGroup[],
  ): void {
    console.log(
      `${logPrefix} food image DB candidate groups`,
      JSON.stringify({
        groups: candidateGroups.map((group) => ({
          foodIndex: group.foodIndex,
          foodName: group.foodName,
          requiredDishType: this.getStrictDishTypeToken(group.foodName),
          candidates: group.candidates.map((candidate) => ({
            menuId: candidate.id,
            menuName: candidate.name,
            menuBrand: candidate.brand,
            menuCategory: candidate.category,
          })),
          preferredCandidateId: group.preferredCandidateId ?? null,
        })),
      }),
    );
  }

  private mergeCandidatesById(
    menus: FoodImageMenuCandidate[],
  ): FoodImageMenuCandidate[] {
    const menuMap = new Map<number, FoodImageMenuCandidate>();

    menus.forEach((menu) => {
      if (!menuMap.has(menu.id)) {
        menuMap.set(menu.id, menu);
      }
    });

    return Array.from(menuMap.values());
  }

  private async rematchWithGemini(
    params: FoodImageMenuMatchParams,
    candidateGroups: FoodImageCandidateGroup[],
  ): Promise<FoodImageMenuMatch[]> {
    const { predictions, timing } = params;

    if (predictions.length === 0 || candidateGroups.length === 0) {
      timing?.mark('food_image_gemini_rematch_skipped', {
        predictionCount: predictions.length,
        groupCount: candidateGroups.length,
      });
      return [];
    }
    const candidateMap = new Map<number, FoodImageMenuCandidate>();
    const candidateIdsByFoodIndex = new Map<number, Set<number>>();
    const preferredCandidateIdsByFoodIndex = new Map<number, number>();

    candidateGroups.forEach((group) => {
      const candidateIds = new Set<number>();
      group.candidates.forEach((candidate) => {
        candidateMap.set(candidate.id, candidate);
        candidateIds.add(candidate.id);
      });
      candidateIdsByFoodIndex.set(group.foodIndex, candidateIds);
      if (group.preferredCandidateId !== undefined) {
        preferredCandidateIdsByFoodIndex.set(
          group.foodIndex,
          group.preferredCandidateId,
        );
      }
    });

    const prompt = `
음식 사진, 1차 인식 결과, 서버가 음식별로 추린 후보 메뉴를 함께 보고 각 음식에 가장 잘 맞는 menu_id를 골라 JSON object로 반환해.

규칙:
- 반드시 JSON object만 반환하고 마크다운, 설명, 코드펜스는 금지
- food_index는 입력 detected_foods의 index 값을 그대로 사용해
- 각 food_index는 자기 candidate_menus 안에 있는 menu_id 중에서만 골라
- 다른 food_index의 후보 menu_id를 가져와서 쓰지 마
- 후보 목록에 없는 메뉴 id는 절대 반환하지 마
${FOOD_IMAGE_REMATCH_PROMPT_RULES}
- 음식 사진의 시각 정보, 1차 food_name, 해당 food_index의 후보 메뉴명/브랜드/카테고리를 함께 비교해
- detected_foods.brand가 null이 아니면 이미지에서 읽힌 브랜드/라벨이므로 후보 메뉴의 브랜드/메뉴명과 강하게 비교해 같은 브랜드 제품을 우선해
- detected_foods.product_name과 brand가 모두 있고 둘이 후보 메뉴의 제품명과 브랜드에 정확히 일치하면 해당 후보를 최우선으로 선택해
- detected_foods.food_name이 완성 음식 형태를 포함하면 후보 메뉴도 같은 형태여야 해. 예: 김치볶음밥 -> 김치볶음은 불일치, 참치김밥 -> 참치샐러드는 불일치, 된장찌개 -> 된장국은 불일치
- food_name이 일반적인 "계란 후라이" 또는 "달걀 후라이"이고 냉동 제품이나 패티라는 시각적 단서가 없으면 "(식약처_음식) 달걀후라이"를 우선해
- "냉동 계란 후라이"나 "계란후라이(패티용)"은 포장·냉동 제품 또는 패티 형태가 명확할 때만 선택해
- food_name이 일반적인 "밥", "흰밥", "쌀밥", "백미밥"이고 포장이나 브랜드 단서가 없으면 "(식약처_음식) 밥"을 우선해
- "따끈한 흰쌀밥 득템" 같은 상품 메뉴는 해당 포장이나 브랜드가 사진에서 명확할 때만 선택해
- food_name이 일반적인 "소금", "정제염", "식염", "소금장", "소금 양념장"이면 "(식약처_가공) 정제염"(menu_id 219056)을 우선해
- 맛소금, 죽염, 트러플소금처럼 종류가 명시된 경우에는 정제염으로 강제하지 마
- 한 음식에 확실히 맞는 후보가 없으면 그 음식은 제외해
- 같은 메뉴가 여러 음식에 보이면 가장 대표적인 food_index 하나만 같은 menu_id에 매칭해

detected_foods:
${JSON.stringify(
  predictions.map((prediction, index) => ({
    index,
    food_name: prediction.foodName,
    product_name: prediction.productName ?? null,
    brand: prediction.brand,
    confidence: prediction.confidence,
  })),
)}

음식별 후보 메뉴:
${JSON.stringify(
  candidateGroups.map((group) => ({
    food_index: group.foodIndex,
    food_name: group.foodName,
    candidate_menus: group.candidates.map(
      ({ id, name, brand, category, unit, ownerUserId, frequentRank }) => ({
        id,
        name,
        brand,
        category,
        unit,
        source:
          ownerUserId != null
            ? 'personal'
            : frequentRank !== undefined
              ? 'frequent'
              : 'public',
      }),
    ),
  })),
)}

반환 shape:
{
  "detected_foods": [
    {
      "food_index": 0,
      "menu_id": 1,
      "confidence": 0.86
    }
  ]
}
`.trim();

    try {
      const data = await params.requestRematchJson(prompt);
      timing?.mark('food_image_gemini_rematch_request_completed', {
        predictionCount: predictions.length,
        groupCount: candidateGroups.length,
        candidateCount: candidateMap.size,
      });
      const detectedFoods: unknown[] = Array.isArray(data?.detected_foods)
        ? data.detected_foods
        : [];

      const recognizedFoods = detectedFoods
        .map((value) =>
          this.normalizeRematchedMenu(
            value,
            predictions,
            candidateMap,
            candidateIdsByFoodIndex,
            preferredCandidateIdsByFoodIndex,
          ),
        )
        .filter((food): food is FoodImageMenuMatch => food !== null);

      return this.deduplicateMatches(recognizedFoods);
    } catch (error) {
      if (isRequestCancellationError(error)) {
        throw error;
      }
      console.warn(`${params.logPrefix} food image Gemini rematch failed`, {
        message: error instanceof Error ? error.message : String(error),
      });
      timing?.mark('food_image_gemini_rematch_failed', {
        predictionCount: predictions.length,
        groupCount: candidateGroups.length,
      });
      return [];
    }
  }

  // 같은 메뉴가 여러 음식에 매칭되면 confidence가 높은 쪽만 남긴다(처음 나온 순서 유지).
  private deduplicateMatches(
    foods: FoodImageMenuMatch[],
  ): FoodImageMenuMatch[] {
    const foodMap = new Map<number, FoodImageMenuMatch>();

    foods.forEach((food) => {
      const existing = foodMap.get(food.id);

      if (!existing) {
        foodMap.set(food.id, food);
        return;
      }

      const existingConfidence = existing.confidence ?? -1;
      const currentConfidence = food.confidence ?? -1;

      if (currentConfidence > existingConfidence) {
        foodMap.set(food.id, food);
      }
    });

    return Array.from(foodMap.values());
  }

  private normalizeRematchedMenu(
    value: unknown,
    predictions: FoodImageMatchPrediction[],
    candidateMap: Map<number, FoodImageMenuCandidate>,
    candidateIdsByFoodIndex: Map<number, Set<number>>,
    preferredCandidateIdsByFoodIndex: Map<number, number> = new Map(),
  ): FoodImageMenuMatch | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const item = value as Record<string, unknown>;
    const foodIndex = parseNullableNumber(item.food_index);
    const menuId = parseNullableNumber(item.menu_id);

    if (
      foodIndex === null ||
      menuId === null ||
      !Number.isInteger(foodIndex) ||
      !Number.isInteger(menuId) ||
      foodIndex < 0 ||
      foodIndex >= predictions.length ||
      !candidateMap.has(menuId) ||
      !candidateIdsByFoodIndex.get(foodIndex)?.has(menuId)
    ) {
      return null;
    }

    const prediction = predictions[foodIndex];
    const groupCandidates = Array.from(
      candidateIdsByFoodIndex.get(foodIndex) ?? [],
    )
      .map((candidateId) => candidateMap.get(candidateId))
      .filter((candidate): candidate is FoodImageMenuCandidate => !!candidate);
    const exactProductMenuId = preferredCandidateIdsByFoodIndex.get(foodIndex);
    const exactProductMenu = exactProductMenuId
      ? candidateMap.get(exactProductMenuId)
      : undefined;
    const preferredMenu = prediction.brand
      ? undefined
      : findPreferredGenericFoodImageCandidate(
          prediction.foodName,
          groupCandidates,
        );
    const matchedMenu = preferUserFoodImageMenu(
      exactProductMenu ?? preferredMenu ?? candidateMap.get(menuId)!,
      groupCandidates,
    );
    if (!this.isDishTypeCompatible(prediction.foodName, matchedMenu)) {
      return null;
    }
    const confidence = parseNullableNumber(item.confidence);

    return this.toMatch(
      matchedMenu,
      foodIndex,
      prediction,
      confidence === null
        ? prediction.confidence
        : roundToThousandth(confidence),
    );
  }

  // Gemini rematch가 빠뜨린 음식만 그 음식의 후보(없으면 전체 메뉴)에서 로컬로 고른다.
  private mergeRematchesWithLocalFallback(
    predictions: FoodImageMatchPrediction[],
    candidateGroups: FoodImageCandidateGroup[],
    menus: FoodImageMenuCandidate[],
    rematchedFoods: FoodImageMenuMatch[],
  ): FoodImageMenuMatch[] {
    const candidateGroupMap = new Map(
      candidateGroups.map((group) => [group.foodIndex, group]),
    );
    const rematchedFoodIndexes = new Set(
      rematchedFoods.map((food) => food.foodIndex),
    );
    const fallbackFoods = predictions
      .map((prediction, foodIndex) => {
        if (rematchedFoodIndexes.has(foodIndex)) {
          return null;
        }

        const group = candidateGroupMap.get(foodIndex);
        const groupCandidates = group?.candidates ?? menus;
        const preferredMenu = group?.preferredCandidateId
          ? groupCandidates.find(
              (candidate) => candidate.id === group.preferredCandidateId,
            )
          : undefined;

        return this.matchPredictionLocally(
          prediction,
          groupCandidates,
          foodIndex,
          preferredMenu,
        );
      })
      .filter((food): food is FoodImageMenuMatch => food !== null);

    return [...rematchedFoods, ...fallbackFoods];
  }

  private matchPredictionLocally(
    prediction: FoodImageMatchPrediction,
    menus: FoodImageMenuCandidate[],
    foodIndex: number,
    preferredMenu?: FoodImageMenuCandidate,
  ): FoodImageMenuMatch | null {
    const preferredGenericMenu = prediction.brand
      ? undefined
      : findPreferredGenericFoodImageCandidate(prediction.foodName, menus);
    const selected =
      preferredMenu ??
      preferredGenericMenu ??
      this.findBestCandidate(prediction, menus, LOCAL_FALLBACK_MIN_SCORE);
    const matchedMenu = selected
      ? preferUserFoodImageMenu(selected, menus)
      : null;

    return matchedMenu &&
      this.isDishTypeCompatible(prediction.foodName, matchedMenu)
      ? this.toMatch(matchedMenu, foodIndex, prediction, prediction.confidence)
      : null;
  }

  private toMatch(
    menu: FoodImageMenuCandidate,
    foodIndex: number,
    prediction: FoodImageMatchPrediction,
    confidence: number | null,
  ): FoodImageMenuMatch {
    return {
      ...menu,
      foodIndex,
      confidence,
      estimatedQuantity: prediction.estimatedQuantity,
      estimatedQuantityUnit: Number(menu.unit) === 1 ? 'ml' : 'g',
      quantityConfidence: prediction.quantityConfidence,
    };
  }

  private isVectorSearchEnabled(): boolean {
    return ['1', 'true', 'yes', 'y'].includes(
      (process.env.VECTOR_SEARCH_ENABLED ?? '').toLowerCase(),
    );
  }

  private getPerFoodCandidateLimit(): number {
    return getEnvNumberInRange(
      'FOOD_IMAGE_PER_FOOD_VECTOR_CANDIDATE_LIMIT',
      8,
      3,
      20,
    );
  }

  private getVectorMatchConcurrency(): number {
    return getEnvNumberInRange('FOOD_IMAGE_VECTOR_MATCH_CONCURRENCY', 4, 1, 8);
  }
}

const roundToThousandth = (value: number): number =>
  Math.round(value * 1000) / 1000;

const getEnvNumberInRange = (
  key: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number(process.env[key] ?? fallback);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.floor(parsed), max));
};
