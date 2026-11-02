import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
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
import {
  RestaurantBrandPlaceResponseDto,
  RestaurantBrandsResponseDto,
} from './dto/response-dto/restaurant-brands-response-dto';
import {
  RestaurantDetailResponseDto,
  RestaurantMenuResponseDto,
} from './dto/response-dto/restaurant-detail-response-dto';
import {
  RestaurantSearchResponseDto,
  RestaurantSummaryResponseDto,
} from './dto/response-dto/restaurant-search-response-dto';
import { RestaurantBranchEntity } from './entity/restaurant-branch.entity';
import { RestaurantMenuEntity } from './entity/restaurant-menu.entity';
import { RestaurantEntity } from './entity/restaurant.entity';
import { KeyedTtlCache } from '../utils/keyed-ttl-cache.util';

// 같은 메뉴가 여러 필터에 걸리면 앞선 필터에 남긴다(#34 결정).
const RESTAURANT_FILTER_PRIORITY = [
  RestaurantMenuFilter.LOW_CALORIE,
  RestaurantMenuFilter.PROTEIN,
  RestaurantMenuFilter.BALANCED,
] as const;
const RECOMMENDATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RECOMMENDATION_CACHE_MAX_ENTRIES = 10_000;

type FilterRecommendations = Record<RestaurantMenuFilter, number[]>;

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

  async findRegisteredBrands(
    dto: RestaurantBrandsRequestDto,
  ): Promise<RestaurantBrandsResponseDto> {
    const placeIds = [...new Set(dto.place_ids)];
    const branches = await this.restaurantBranchRepository.find({
      where: { kakaoPlaceId: In(placeIds), restaurantId: Not(IsNull()) },
      relations: { restaurant: true },
      select: {
        id: true,
        kakaoPlaceId: true,
        restaurant: { id: true, name: true },
      },
    });
    const branchByPlaceId = new Map(
      branches.map((branch) => [branch.kakaoPlaceId, branch]),
    );

    const restaurants = placeIds.flatMap(
      (placeId): RestaurantBrandPlaceResponseDto[] => {
        const restaurant = branchByPlaceId.get(placeId)?.restaurant;
        return restaurant
          ? [
              {
                place_id: Number(placeId),
                restaurant_id: restaurant.id,
                restaurant_name: restaurant.name,
              },
            ]
          : [];
      },
    );

    return { restaurants };
  }

  async getRestaurantDetail(
    dto: RestaurantDetailRequestDto,
    userId: number,
  ): Promise<RestaurantDetailResponseDto> {
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
        menu_list: menus.map((menu) => this.toResponse(menu)),
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
        this.toResponse(menuById.get(menuId)),
      ),
    };
  }

  // 세 필터 추천을 한 번에 계산해 필터 간 중복을 빼고, 입력이 같으면 같은 결과를 내도록 캐시한다.
  // 캐시 키에는 프로필·최근 3일 식사 기록·후보 메뉴가 들어가므로 식사를 기록하면 새로 계산한다.
  private async getFilterRecommendations(
    restaurant: RestaurantEntity,
    candidates: RestaurantMenuEntity[],
    userId: number,
    limit: number,
  ): Promise<FilterRecommendations> {
    const menus = candidates.map((menu) => this.toRecommendationInput(menu));
    let userContext: RestaurantRecommendationUserContext;
    try {
      userContext =
        await this.chatService.getRestaurantRecommendationUserContext(userId);
    } catch (error) {
      this.logRecommendationFallback(restaurant, userId, error);
      return this.assignRecommendations(
        this.fallbackRankings(candidates),
        limit,
      );
    }

    const cacheKey = createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          restaurantId: restaurant.id,
          limit,
          menus,
          userContext,
        }),
      )
      .digest('hex');
    const cached = this.recommendationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let pending = this.pendingRecommendations.get(cacheKey);
    if (!pending) {
      pending = this.computeFilterRecommendations(
        restaurant,
        candidates,
        menus,
        userContext,
        userId,
        limit,
        cacheKey,
      ).finally(() => this.pendingRecommendations.delete(cacheKey));
      this.pendingRecommendations.set(cacheKey, pending);
    }

    return await pending;
  }

  private async computeFilterRecommendations(
    restaurant: RestaurantEntity,
    candidates: RestaurantMenuEntity[],
    menus: RestaurantRecommendationMenuInput[],
    userContext: RestaurantRecommendationUserContext,
    userId: number,
    limit: number,
    cacheKey: string,
  ): Promise<FilterRecommendations> {
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
      // 실패 결과는 캐시하지 않아 다음 요청에서 Gemini를 다시 시도한다.
      this.logRecommendationFallback(restaurant, userId, error);
      return this.assignRecommendations(fallbackRankings, limit);
    }

    // Gemini 순위가 짧으면 규칙 기반 순위로 뒤를 채운다.
    const candidateIds = new Set(candidates.map((menu) => menu.id));
    const rankings = Object.fromEntries(
      RESTAURANT_FILTER_PRIORITY.map((filter) => [
        filter,
        [
          ...new Set([
            ...(geminiRankings[filter] ?? []).filter((id) =>
              candidateIds.has(id),
            ),
            ...fallbackRankings[filter],
          ]),
        ],
      ]),
    ) as RestaurantMenuRankings;
    const recommendations = this.assignRecommendations(rankings, limit);
    this.recommendationCache.set(cacheKey, recommendations);

    return recommendations;
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

  private fallbackRankings(
    menus: RestaurantMenuEntity[],
  ): RestaurantMenuRankings {
    return Object.fromEntries(
      RESTAURANT_FILTER_PRIORITY.map((filter) => [
        filter,
        this.fallbackRecommendations(menus, filter).map((menu) => menu.id),
      ]),
    ) as RestaurantMenuRankings;
  }

  private logRecommendationFallback(
    restaurant: RestaurantEntity,
    userId: number,
    error: unknown,
  ): void {
    console.error('[RESTAURANT] Gemini recommendation failed; fallback used', {
      restaurantId: restaurant.id,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private fallbackRecommendations(
    menus: RestaurantMenuEntity[],
    filter: RestaurantMenuFilter,
  ): RestaurantMenuEntity[] {
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

  private balanceDistance(menu: RestaurantMenuEntity): number {
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

  private toRecommendationInput(menu: RestaurantMenuEntity) {
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

  private toResponse(menu: RestaurantMenuEntity): RestaurantMenuResponseDto {
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
