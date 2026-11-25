import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  ChatService,
  RestaurantMenuRankings,
  RestaurantRecommendationMenuInput,
  RestaurantRecommendationUserContext,
} from '../chat/chat.service';
import {
  RestaurantDetailRequestDto,
  RestaurantMenuFilter,
} from './dto/request-dto/restaurant-detail-request-dto';
import { RestaurantSearchRequestDto } from './dto/request-dto/restaurant-search-request-dto';
import { RestaurantBrandsRequestDto } from './dto/request-dto/restaurant-brands-request-dto';
import { RestaurantPlaceRequestDto } from './dto/request-dto/restaurant-place-request-dto';
import {
  RestaurantBrandPlaceResponseDto,
  RestaurantBrandsResponseDto,
} from './dto/response-dto/restaurant-brands-response-dto';
import {
  RestaurantDetailResponseDto,
  RestaurantMenuNutritionSource,
  RestaurantMenuResponseDto,
} from './dto/response-dto/restaurant-detail-response-dto';
import { RestaurantPlaceResponseDto } from './dto/response-dto/restaurant-place-response-dto';
import {
  RestaurantSearchResponseDto,
  RestaurantSummaryResponseDto,
} from './dto/response-dto/restaurant-search-response-dto';
import { RestaurantBranchEntity } from './entity/restaurant-branch.entity';
import { RestaurantBranchMenuEntity } from './entity/restaurant-branch-menu.entity';
import { RestaurantMenuEntity } from './entity/restaurant-menu.entity';
import { RestaurantEntity } from './entity/restaurant.entity';
import { RestaurantMenuNutritionEstimateEntity } from './entity/restaurant-menu-nutrition-estimate.entity';
import {
  BRANCH_MENU_ID_OFFSET,
  INDEPENDENT_RESTAURANT_ID_OFFSET,
  MIN_DISPLAY_ESTIMATE_CONFIDENCE,
} from './branch-menu-estimate.constants';
import { normalizeBranchMenuName } from '../utils/branch-menu-name.util';
import { KeyedTtlCache } from '../utils/keyed-ttl-cache.util';
import {
  getRequestAbortSignal,
  isRequestCancellationError,
} from '../utils/request-abort.util';

// 같은 메뉴가 여러 필터에 걸리면 앞선 필터에 남긴다(#34 결정).
const RESTAURANT_FILTER_PRIORITY = [
  RestaurantMenuFilter.LOW_CALORIE,
  RestaurantMenuFilter.PROTEIN,
  RestaurantMenuFilter.BALANCED,
] as const;
const RECOMMENDATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RECOMMENDATION_CACHE_MAX_ENTRIES = 10_000;

type FilterRecommendations = Record<RestaurantMenuFilter, number[]>;

// 추천·응답에 쓰는 메뉴 필드. 브랜드 공식 메뉴(RestaurantMenuEntity)와 개인 식당 추정 메뉴(#41)가 같이 쓴다.
type DetailMenu = Pick<
  RestaurantMenuEntity,
  | 'id'
  | 'name'
  | 'menuCategory'
  | 'calories'
  | 'carbs'
  | 'sugars'
  | 'dietaryFiber'
  | 'protein'
  | 'fat'
  | 'satFat'
  | 'sodium'
  | 'unit'
  | 'weight'
  | 'unitQuantity'
>;
type DetailRestaurant = Pick<RestaurantEntity, 'id' | 'name' | 'category'>;

// IN 목록 한 번에 넣는 정규화 메뉴명 수.
const ESTIMATE_LOOKUP_CHUNK_SIZE = 1_000;
// 개인 식당 메뉴는 메뉴 카테고리가 없어 정규화 이름(소문자, 공백·기호 없음)과 추정 칼로리로 비식사 메뉴를 추천에서 뺀다.
// 음료·주류와 곱빼기·추가·사리·포장·배달 같은 주문 옵션: 이름 끝이 맞으면 칼로리와 관계없이 뺀다.
// 뒤에 붙은 용량·개수 표기(500cc, 3종 등)는 허용한다.
const BRANCH_NON_MEAL_MENU_PATTERN =
  /(콜라|사이다|환타|스프라이트|음료|주스|쥬스|에이드|아메리카노|라떼|커피|소주|맥주|막걸리|하이볼|와인|사케|청하|생수|탄산수|식혜|아이스티|밀크티|홍차|녹차|보리차|유자차|스무디|쉐이크|셰이크|소다|우유|두유|곱빼기|추가|사리|포장|배달)(\d+(?:[a-z]*|종))?$/;
// 소스·드레싱·토핑, 반찬·김치·절임류, 장류·양념: 이름 끝이 맞고 추정 칼로리가 기준 미만일 때만 뺀다.
// 순살간장(치킨)·돼지김치·새우칠리소스처럼 이름 끝이 같아도 칼로리가 큰 식사 메뉴는 남긴다(#43 PR 메인 세션 확인).
// 끝에 붙은 용량·개수 표기(30g, 3종 등)는 허용한다.
const BRANCH_SIDE_MENU_PATTERN =
  /(소스|드레싱|시즈닝|토핑|반찬|김치|깍두기|단무지|치킨무|피클|장아찌|조미김|와사비|케찹|케첩|머스타드|마요네즈|쌈장|고추장|간장|초장|양념장|참기름)(\d+(?:[a-z]*|종))?$/;
const BRANCH_SIDE_MENU_MAX_CALORIES = 200;
// 밥 단품: 이름 전체가 맞을 때만 뺀다(앞의 "추가"는 허용). 수비드목살현미밥·...정식공기밥 같은 세트는 남긴다.
// #43 이전에는 공기밥을 이름 끝으로 뺐지만 세트 메뉴 오탐이 생겨 다른 밥 단품과 같은 전체 매칭으로 바꿨다.
const BRANCH_PLAIN_RICE_MENU_PATTERN =
  /^(추가)?(밥|공기밥|공깃밥|흰밥|쌀밥|백미밥|현미밥|잡곡밥|흑미밥|찹쌀밥|오곡밥|즉석밥|햇반)(\d+[a-z]*)?$/;

// 추정 칼로리가 없으면(null·빈 값) 소스·반찬 묶음으로 빼지 않는다. 표시 대상 추정값은 칼로리가 항상 있다.
export function isBranchNonMealMenu(
  menuName: string,
  calories: number | string | null | undefined,
): boolean {
  const name = normalizeBranchMenuName(menuName);
  if (
    BRANCH_NON_MEAL_MENU_PATTERN.test(name) ||
    BRANCH_PLAIN_RICE_MENU_PATTERN.test(name)
  ) {
    return true;
  }
  const kcal = calories == null || calories === '' ? NaN : Number(calories);
  return (
    Number.isFinite(kcal) &&
    kcal < BRANCH_SIDE_MENU_MAX_CALORIES &&
    BRANCH_SIDE_MENU_PATTERN.test(name)
  );
}

@Injectable()
export class RestaurantService {
  private readonly recommendationLimit = 5;
  private readonly gcovaRecommendationLimit = 2;
  private readonly recommendationCache =
    new KeyedTtlCache<FilterRecommendations>(
      RECOMMENDATION_CACHE_TTL_MS,
      RECOMMENDATION_CACHE_MAX_ENTRIES,
    );
  private readonly pendingRecommendations = new Map<
    string,
    Promise<FilterRecommendations>
  >();

  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepository: Repository<RestaurantEntity>,
    @InjectRepository(RestaurantMenuEntity)
    private readonly restaurantMenuRepository: Repository<RestaurantMenuEntity>,
    private readonly chatService: ChatService,
    @InjectRepository(RestaurantBranchEntity)
    private readonly restaurantBranchRepository: Repository<RestaurantBranchEntity>,
    @InjectRepository(RestaurantBranchMenuEntity)
    private readonly restaurantBranchMenuRepository: Repository<RestaurantBranchMenuEntity>,
    @InjectRepository(RestaurantMenuNutritionEstimateEntity)
    private readonly menuNutritionEstimateRepository: Repository<RestaurantMenuNutritionEstimateEntity>,
  ) {}

  async searchRestaurants(
    dto: RestaurantSearchRequestDto,
  ): Promise<RestaurantSearchResponseDto> {
    const input = this.normalizeSearchText(dto.input);
    const query = this.restaurantRepository
      .createQueryBuilder('restaurant')
      .orderBy('restaurant.id', 'ASC')
      .take(dto.limit + 1);

    if (input) {
      query.andWhere('restaurant.normalized_name LIKE :input', {
        input: `%${input}%`,
      });
    }

    if (dto.cursor != null) {
      query.andWhere('restaurant.id > :cursor', { cursor: dto.cursor });
    }

    const rows = await query.getMany();
    const hasNext = rows.length > dto.limit;
    const pageRows = hasNext ? rows.slice(0, dto.limit) : rows;
    const restaurantList: RestaurantSummaryResponseDto[] = pageRows.map(
      (restaurant) => ({
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        category: restaurant.category,
      }),
    );

    return {
      restaurant_list: restaurantList,
      next_cursor: hasNext
        ? restaurantList[restaurantList.length - 1].restaurant_id
        : null,
    };
  }

  // 수집한 카카오 장소 전부(개인 식당 포함)를 요청 순서대로 돌려준다(#39 결정).
  // 개인 식당은 카카오 장소명을 이름으로 쓴다. 표시할 영양 추정 메뉴가 있으면 가상 restaurant_id
  // (INDEPENDENT_RESTAURANT_ID_OFFSET + branch.id)로 /restaurant/detail을 열고, 없으면 null이다(#41 결정).
  // restaurant_id만 NULL이고 match_source가 남은 행은 restaurant:import가 브랜드를 지워
  // 매핑이 끊긴 프랜차이즈 지점이다. 개인 식당으로 내보내지 않고 예전처럼 뺀다.
  async findRegisteredBrands(
    dto: RestaurantBrandsRequestDto,
  ): Promise<RestaurantBrandsResponseDto> {
    const placeIds = [...new Set(dto.place_ids)];
    const kakaoPlaceId = In(placeIds);
    const branches = await this.restaurantBranchRepository.find({
      where: [
        { kakaoPlaceId, restaurantId: Not(IsNull()) },
        { kakaoPlaceId, restaurantId: IsNull(), matchSource: IsNull() },
      ],
      relations: { restaurant: true },
      select: {
        id: true,
        kakaoPlaceId: true,
        placeName: true,
        restaurant: { id: true, name: true },
      },
    });
    const branchByPlaceId = new Map(
      branches.map((branch) => [branch.kakaoPlaceId, branch]),
    );
    const estimatedBranchIds = await this.findBranchIdsWithDisplayableEstimates(
      branches
        .filter((branch) => !branch.restaurant)
        .map((branch) => branch.id),
    );

    const restaurants = placeIds.flatMap(
      (placeId): RestaurantBrandPlaceResponseDto[] => {
        const branch = branchByPlaceId.get(placeId);
        if (!branch) return [];
        const restaurant = branch.restaurant;
        return [
          {
            place_id: Number(placeId),
            restaurant_id:
              restaurant?.id ??
              (estimatedBranchIds.has(branch.id)
                ? INDEPENDENT_RESTAURANT_ID_OFFSET + branch.id
                : null),
            restaurant_name: restaurant?.name ?? branch.placeName,
          },
        ];
      },
    );

    return { restaurants };
  }

  // 카카오 장소(지점) 하나의 카카오 메뉴와 브랜드 매핑. 프랜차이즈 지점의 영양정보 메뉴는
  // 프론트가 restaurant_id로 /restaurant/detail을 따로 부른다(#30 결정).
  async findPlace(
    dto: RestaurantPlaceRequestDto,
  ): Promise<RestaurantPlaceResponseDto> {
    const branch = await this.restaurantBranchRepository.findOne({
      where: { kakaoPlaceId: dto.place_id },
      relations: { restaurant: true },
      select: {
        id: true,
        kakaoPlaceId: true,
        placeName: true,
        address: true,
        restaurant: { id: true, name: true },
      },
    });
    if (!branch) {
      throw new NotFoundException('Place not found');
    }

    const menus = await this.restaurantBranchMenuRepository.find({
      where: { branchId: branch.id },
      order: { sortOrder: 'ASC' },
      select: { id: true, name: true, photoUrl: true },
    });

    return {
      place_id: Number(branch.kakaoPlaceId),
      place_name: branch.placeName,
      address: branch.address ?? null,
      restaurant_id: branch.restaurant?.id ?? null,
      restaurant_name: branch.restaurant?.name ?? null,
      menu_list: menus.map((menu) => ({
        menu_name: menu.name,
        photo_url: menu.photoUrl ?? null,
      })),
    };
  }

  async getRestaurantDetail(
    dto: RestaurantDetailRequestDto,
    userId: number,
  ): Promise<RestaurantDetailResponseDto> {
    if (dto.restaurant_id >= INDEPENDENT_RESTAURANT_ID_OFFSET) {
      return await this.getIndependentRestaurantDetail(dto, userId);
    }

    const restaurant = await this.restaurantRepository.findOne({
      where: { id: dto.restaurant_id },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const menus = await this.restaurantMenuRepository.find({
      where: { restaurantId: restaurant.id },
      order: { id: 'ASC' },
    });
    if (menus.length === 0) {
      return { restaurant_name: restaurant.name, menu_list: [] };
    }

    if (dto.filter == null) {
      return {
        restaurant_name: restaurant.name,
        menu_list: menus.map((menu) =>
          this.toResponse(menu, RestaurantMenuNutritionSource.OFFICIAL),
        ),
      };
    }

    const recommendationCandidates = menus.filter((menu) =>
      this.isRecommendationCandidate(menu, restaurant.category),
    );
    if (recommendationCandidates.length === 0) {
      return { restaurant_name: restaurant.name, menu_list: [] };
    }

    const recommendations = await this.getFilterRecommendations(
      restaurant,
      recommendationCandidates,
      userId,
      restaurant.name === '지코바치킨'
        ? this.gcovaRecommendationLimit
        : this.recommendationLimit,
    );
    const menuById = new Map(
      recommendationCandidates.map((menu) => [menu.id, menu]),
    );

    return {
      restaurant_name: restaurant.name,
      menu_list: recommendations[dto.filter].map((menuId) =>
        this.toResponse(
          menuById.get(menuId),
          RestaurantMenuNutritionSource.OFFICIAL,
        ),
      ),
    };
  }

  // 개인 식당(가상 restaurant_id) 상세: 카카오 지점 메뉴 중 표시할 추정값이 있는 메뉴만 기존 응답 형식으로 준다.
  // 추정값이 없거나 confidence가 기준 미만인 메뉴는 filter와 관계없이 뺀다(#41 결정 1).
  private async getIndependentRestaurantDetail(
    dto: RestaurantDetailRequestDto,
    userId: number,
  ): Promise<RestaurantDetailResponseDto> {
    const restaurantId = dto.restaurant_id;
    const branch = await this.restaurantBranchRepository.findOne({
      where: {
        id: restaurantId - INDEPENDENT_RESTAURANT_ID_OFFSET,
        restaurantId: IsNull(),
        matchSource: IsNull(),
      },
      select: { id: true, placeName: true, kakaoCategory: true },
    });
    if (!branch) {
      throw new NotFoundException('Restaurant not found');
    }

    const branchMenus = await this.restaurantBranchMenuRepository.find({
      where: { branchId: branch.id },
      order: { sortOrder: 'ASC' },
      select: { id: true, name: true },
    });
    const estimates = await this.findDisplayableEstimates(
      branchMenus.map((menu) => menu.name),
    );
    const menus = branchMenus.flatMap((menu): DetailMenu[] => {
      const estimate = estimates.get(normalizeBranchMenuName(menu.name));
      return estimate ? [this.toEstimatedMenu(menu, estimate)] : [];
    });
    if (menus.length === 0 || dto.filter == null) {
      return {
        restaurant_name: branch.placeName,
        menu_list: menus.map((menu) =>
          this.toResponse(menu, RestaurantMenuNutritionSource.ESTIMATED),
        ),
      };
    }

    const candidates = menus.filter(
      (menu) => !isBranchNonMealMenu(menu.name, menu.calories),
    );
    if (candidates.length === 0) {
      return { restaurant_name: branch.placeName, menu_list: [] };
    }
    const restaurant: DetailRestaurant = {
      id: restaurantId,
      name: branch.placeName,
      category:
        (branch.kakaoCategory ?? '').replace(/^음식점\s*>\s*/, '').trim() ||
        null,
    };
    const recommendations = await this.getFilterRecommendations(
      restaurant,
      candidates,
      userId,
      this.recommendationLimit,
    );
    const menuById = new Map(candidates.map((menu) => [menu.id, menu]));

    return {
      restaurant_name: branch.placeName,
      menu_list: recommendations[dto.filter].map((menuId) =>
        this.toResponse(
          menuById.get(menuId),
          RestaurantMenuNutritionSource.ESTIMATED,
        ),
      ),
    };
  }

  // 표시할 추정 메뉴가 하나 이상 있는 개인 식당 지점 id. 조회가 실패하면(예: 추정 테이블 마이그레이션 전)
  // 가상 id 없이 지금처럼 null로 내보내도록 빈 집합을 돌려준다(/restaurant/brands를 깨지 않기 위해).
  private async findBranchIdsWithDisplayableEstimates(
    branchIds: number[],
  ): Promise<Set<number>> {
    if (branchIds.length === 0) {
      return new Set();
    }
    try {
      const menus = await this.restaurantBranchMenuRepository.find({
        where: { branchId: In(branchIds) },
        select: { id: true, branchId: true, name: true },
      });
      const estimates = await this.findDisplayableEstimates(
        menus.map((menu) => menu.name),
      );
      return new Set(
        menus
          .filter((menu) => estimates.has(normalizeBranchMenuName(menu.name)))
          .map((menu) => menu.branchId),
      );
    } catch (error) {
      if (isRequestCancellationError(error)) {
        throw error;
      }
      console.error(
        '[RESTAURANT] Branch menu estimate lookup failed; independent places returned without restaurant_id',
        {
          branchCount: branchIds.length,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return new Set();
    }
  }

  // 정규화 메뉴명 → 앱에 내보낼 수 있는 추정값(칼로리가 있고 confidence가 기준 이상).
  private async findDisplayableEstimates(
    menuNames: string[],
  ): Promise<Map<string, RestaurantMenuNutritionEstimateEntity>> {
    const keys = [
      ...new Set(menuNames.map(normalizeBranchMenuName).filter(Boolean)),
    ];
    const estimates = new Map<string, RestaurantMenuNutritionEstimateEntity>();
    for (
      let start = 0;
      start < keys.length;
      start += ESTIMATE_LOOKUP_CHUNK_SIZE
    ) {
      const rows = await this.menuNutritionEstimateRepository.find({
        where: {
          normalizedName: In(
            keys.slice(start, start + ESTIMATE_LOOKUP_CHUNK_SIZE),
          ),
          calories: Not(IsNull()),
          confidence: MoreThanOrEqual(MIN_DISPLAY_ESTIMATE_CONFIDENCE),
        },
        select: {
          id: true,
          normalizedName: true,
          calories: true,
          carbs: true,
          protein: true,
          fat: true,
          sugars: true,
          satFat: true,
          unit: true,
          weight: true,
          unitQuantity: true,
        },
      });
      rows.forEach((row) => estimates.set(row.normalizedName, row));
    }
    return estimates;
  }

  // 가상 menu_id(BRANCH_MENU_ID_OFFSET + restaurant_branch_menu.id)는 표시·추천용이고 식사 기록과 잇지 않는다.
  private toEstimatedMenu(
    menu: Pick<RestaurantBranchMenuEntity, 'id' | 'name'>,
    estimate: RestaurantMenuNutritionEstimateEntity,
  ): DetailMenu {
    return {
      id: BRANCH_MENU_ID_OFFSET + menu.id,
      name: menu.name,
      menuCategory: null,
      calories: estimate.calories,
      carbs: estimate.carbs,
      sugars: estimate.sugars,
      dietaryFiber: null,
      protein: estimate.protein,
      fat: estimate.fat,
      satFat: estimate.satFat,
      sodium: null,
      unit: estimate.unit,
      weight: estimate.weight,
      unitQuantity: estimate.unitQuantity,
    };
  }

  // 세 필터 추천을 한 번에 계산해 필터 간 중복을 빼고, 입력이 같으면 같은 결과를 내도록 캐시한다.
  // 캐시 키에는 프로필·최근 3일 식사 기록·후보 메뉴가 들어가므로 식사를 기록하면 새로 계산한다.
  private async getFilterRecommendations(
    restaurant: DetailRestaurant,
    candidates: DetailMenu[],
    userId: number,
    limit: number,
  ): Promise<FilterRecommendations> {
    const menus = candidates.map((menu) => this.toRecommendationInput(menu));
    let userContext: RestaurantRecommendationUserContext;
    try {
      userContext =
        await this.chatService.getRestaurantRecommendationUserContext(userId);
    } catch (error) {
      if (isRequestCancellationError(error)) {
        throw error;
      }
      this.logRecommendationFallback(
        'User context unavailable',
        restaurant,
        userId,
        error,
      );
      return this.assignRecommendations(
        this.fallbackRankings(candidates),
        limit,
      );
    }

    // limit은 식당 이름으로 정해지므로 키에 따로 넣지 않는다.
    const cacheKey = createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            category: restaurant.category,
          },
          menus,
          userContext,
        }),
      )
      .digest('hex');

    for (;;) {
      const cached = this.recommendationCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      let pending = this.pendingRecommendations.get(cacheKey);
      const startedByOtherRequest = pending != null;
      if (!pending) {
        pending = this.computeFilterRecommendations(
          restaurant,
          candidates,
          menus,
          userContext,
          userId,
          limit,
        )
          .then((recommendations) => {
            if (recommendations.cacheable) {
              this.recommendationCache.set(cacheKey, recommendations.value);
            }
            return recommendations.value;
          })
          .finally(() => this.pendingRecommendations.delete(cacheKey));
        this.pendingRecommendations.set(cacheKey, pending);
      }

      try {
        return await pending;
      } catch (error) {
        // 계산을 시작한 다른 요청의 연결이 끊겨 취소됐으면 이 요청에서 다시 계산한다.
        if (
          startedByOtherRequest &&
          isRequestCancellationError(error) &&
          getRequestAbortSignal()?.aborted !== true
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  private async computeFilterRecommendations(
    restaurant: DetailRestaurant,
    candidates: DetailMenu[],
    menus: RestaurantRecommendationMenuInput[],
    userContext: RestaurantRecommendationUserContext,
    userId: number,
    limit: number,
  ): Promise<{ value: FilterRecommendations; cacheable: boolean }> {
    const fallbackRankings = this.fallbackRankings(candidates);
    let geminiRankings: RestaurantMenuRankings;
    try {
      geminiRankings = await this.chatService.rankRestaurantMenusByFilter({
        restaurantName: restaurant.name,
        restaurantCategory: restaurant.category,
        userContext,
        menus,
      });
    } catch (error) {
      if (isRequestCancellationError(error)) {
        throw error;
      }
      // 실패 결과는 캐시하지 않아 다음 요청에서 Gemini를 다시 시도한다.
      this.logRecommendationFallback(
        'Gemini recommendation failed',
        restaurant,
        userId,
        error,
      );
      return {
        value: this.assignRecommendations(fallbackRankings, limit),
        cacheable: false,
      };
    }

    // Gemini 순위가 짧으면 규칙 기반 순위로 뒤를 채운다.
    const candidateIds = new Set(candidates.map((menu) => menu.id));
    const validGeminiRankings = Object.fromEntries(
      RESTAURANT_FILTER_PRIORITY.map((filter) => [
        filter,
        (geminiRankings[filter] ?? []).filter((id) => candidateIds.has(id)),
      ]),
    ) as RestaurantMenuRankings;
    const rankings = Object.fromEntries(
      RESTAURANT_FILTER_PRIORITY.map((filter) => [
        filter,
        [
          ...new Set([
            ...validGeminiRankings[filter],
            ...fallbackRankings[filter],
          ]),
        ],
      ]),
    ) as RestaurantMenuRankings;
    // 쓸 수 있는 순위가 하나도 없으면(응답 형식 오류 등) 실패처럼 캐시하지 않는다.
    const cacheable = RESTAURANT_FILTER_PRIORITY.some(
      (filter) => validGeminiRankings[filter].length > 0,
    );
    if (!cacheable) {
      this.logRecommendationFallback(
        'Gemini recommendation returned no usable ranking',
        restaurant,
        userId,
        null,
      );
    }

    return {
      value: this.assignRecommendations(rankings, limit),
      cacheable,
    };
  }

  // 우선순위가 높은 필터부터 메뉴를 차지한다. 겹치지 않는 메뉴로 limit을 못 채우면
  // 그 필터 순위에서 다른 필터가 가져간 메뉴로 채우고, 결과는 그 필터의 순위 순서로 둔다.
  private assignRecommendations(
    rankings: RestaurantMenuRankings,
    limit: number,
  ): FilterRecommendations {
    const assignedIds = new Set<number>();
    const recommendations = {} as FilterRecommendations;

    for (const filter of RESTAURANT_FILTER_PRIORITY) {
      const ranking = rankings[filter];
      const unique = ranking.filter((id) => !assignedIds.has(id));
      const picked = new Set(unique.slice(0, limit));
      for (const id of ranking) {
        if (picked.size >= limit) {
          break;
        }
        picked.add(id);
      }

      recommendations[filter] = ranking.filter((id) => picked.has(id));
      recommendations[filter].forEach((id) => assignedIds.add(id));
    }

    return recommendations;
  }

  private fallbackRankings(menus: DetailMenu[]): RestaurantMenuRankings {
    return Object.fromEntries(
      RESTAURANT_FILTER_PRIORITY.map((filter) => [
        filter,
        this.fallbackRecommendations(menus, filter).map((menu) => menu.id),
      ]),
    ) as RestaurantMenuRankings;
  }

  private logRecommendationFallback(
    reason: string,
    restaurant: DetailRestaurant,
    userId: number,
    error: unknown,
  ): void {
    console.error(`[RESTAURANT] ${reason}; fallback used`, {
      restaurantId: restaurant.id,
      userId,
      error:
        error == null
          ? null
          : error instanceof Error
            ? error.message
            : String(error),
    });
  }

  private fallbackRecommendations(
    menus: DetailMenu[],
    filter: RestaurantMenuFilter,
  ): DetailMenu[] {
    const sorted = [...menus];

    if (filter === RestaurantMenuFilter.LOW_CALORIE) {
      return sorted.sort(
        (a, b) => this.numberValue(a.calories) - this.numberValue(b.calories),
      );
    }

    if (filter === RestaurantMenuFilter.PROTEIN) {
      return sorted.sort((a, b) => {
        const proteinDifference =
          this.numberValue(b.protein) - this.numberValue(a.protein);
        return proteinDifference !== 0
          ? proteinDifference
          : this.numberValue(a.calories) - this.numberValue(b.calories);
      });
    }

    return sorted.sort((a, b) => {
      const aDistance = this.balanceDistance(a);
      const bDistance = this.balanceDistance(b);
      return aDistance !== bDistance
        ? aDistance - bDistance
        : this.numberValue(a.calories) - this.numberValue(b.calories);
    });
  }

  private balanceDistance(menu: DetailMenu): number {
    const carbsCalories = this.numberValue(menu.carbs) * 4;
    const proteinCalories = this.numberValue(menu.protein) * 4;
    const fatCalories = this.numberValue(menu.fat) * 9;
    const macroCalories = carbsCalories + proteinCalories + fatCalories;
    if (macroCalories <= 0) {
      return Number.MAX_SAFE_INTEGER;
    }

    return (
      Math.abs(carbsCalories / macroCalories - 0.5) +
      Math.abs(proteinCalories / macroCalories - 0.2) +
      Math.abs(fatCalories / macroCalories - 0.3)
    );
  }

  private toRecommendationInput(
    menu: DetailMenu,
  ): RestaurantRecommendationMenuInput {
    return {
      menu_id: menu.id,
      menu_name: menu.name,
      menu_category: menu.menuCategory,
      calories: this.numberValue(menu.calories),
      carbs: this.nullableNumber(menu.carbs),
      sugars: this.nullableNumber(menu.sugars),
      dietary_fiber: this.nullableNumber(menu.dietaryFiber),
      protein: this.nullableNumber(menu.protein),
      fat: this.nullableNumber(menu.fat),
      saturated_fat: this.nullableNumber(menu.satFat),
      sodium: this.nullableNumber(menu.sodium),
      unit: menu.unit,
      weight: this.nullableNumber(menu.weight),
      unit_quantity: menu.unitQuantity,
    };
  }

  // 출처는 호출 경로로 정한다: 브랜드 restaurant_menu는 official, 개인 식당 추정 메뉴는 estimated(#45).
  private toResponse(
    menu: DetailMenu,
    nutritionSource: RestaurantMenuNutritionSource,
  ): RestaurantMenuResponseDto {
    return {
      menu_id: menu.id,
      menu_name: menu.name,
      menu_category: menu.menuCategory ?? null,
      calories: this.numberValue(menu.calories),
      sugars: this.nullableNumber(menu.sugars),
      protein: this.nullableNumber(menu.protein),
      sat_fat: this.nullableNumber(menu.satFat),
      unit: menu.unit,
      weight: this.nullableNumber(menu.weight),
      unit_quantity: menu.unitQuantity,
      nutrition_source: nutritionSource,
    };
  }

  private normalizeSearchText(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '');
  }

  private isBeverageMenu(menu: RestaurantMenuEntity): boolean {
    const category = (menu.menuCategory ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

    return (
      category === '티' ||
      /음료|커피|콜드브루|드링크|에이드|주스|프라페|스무디|쉐이크|베버리지|빽스치노|아이스샷|생과일/.test(
        category,
      )
    );
  }

  private isSideMenu(menu: RestaurantMenuEntity): boolean {
    const category = (menu.menuCategory ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

    return category.includes('사이드');
  }

  private isComponentMenu(
    menu: RestaurantMenuEntity,
    restaurantCategory: string | null,
  ): boolean {
    const menuCategory = (menu.menuCategory ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    const excludedCategories: Record<string, Set<string>> = {
      버거: new Set(['소스', '소스&시즈닝', '토핑', '토핑메뉴', '버거(토핑)']),
      치킨: new Set(['소스', '재료추가']),
      피자: new Set(['소스', '토핑', '추가토핑®']),
      '샌드위치/샐러드': new Set([
        '토핑',
        '소스',
        '드레싱',
        '빵',
        '야채',
        '베이스',
        '치즈',
      ]),
      베이커리: new Set(['토핑', '크림', '딥']),
      // 단품/실속반찬(반찬 제육볶음, 단품 카레 등)은 식사로 볼 수 있어 후보에 남긴다(#43).
      도시락: new Set(['소스', '미니반찬&집반찬', '밥', '스낵', '디저트']),
    };

    return (
      excludedCategories[restaurantCategory ?? '']?.has(menuCategory) ?? false
    );
  }

  private isRecommendationCandidate(
    menu: RestaurantMenuEntity,
    restaurantCategory: string | null,
  ): boolean {
    if (restaurantCategory === '카페') {
      return true;
    }
    if (this.isBeverageMenu(menu)) {
      return false;
    }
    if (restaurantCategory !== '베이커리' && this.isSideMenu(menu)) {
      return false;
    }
    if (this.isComponentMenu(menu, restaurantCategory)) {
      return false;
    }
    return true;
  }

  private numberValue(value: number | string | null | undefined): number {
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : 0;
  }

  private nullableNumber(
    value: number | string | null | undefined,
  ): number | null {
    if (value == null || value === '') {
      return null;
    }
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : null;
  }
}
