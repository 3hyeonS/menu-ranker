import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatService } from '../chat/chat.service';
import {
  RestaurantDetailRequestDto,
  RestaurantMenuFilter,
} from './dto/request-dto/restaurant-detail-request-dto';
import { RestaurantSearchRequestDto } from './dto/request-dto/restaurant-search-request-dto';
import {
  RestaurantDetailResponseDto,
  RestaurantMenuResponseDto,
} from './dto/response-dto/restaurant-detail-response-dto';
import {
  RestaurantSearchResponseDto,
  RestaurantSummaryResponseDto,
} from './dto/response-dto/restaurant-search-response-dto';
import { RestaurantMenuEntity } from './entity/restaurant-menu.entity';
import { RestaurantEntity } from './entity/restaurant.entity';

@Injectable()
export class RestaurantService {
  private readonly recommendationLimit = 5;

  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepository: Repository<RestaurantEntity>,
    @InjectRepository(RestaurantMenuEntity)
    private readonly restaurantMenuRepository: Repository<RestaurantMenuEntity>,
    private readonly chatService: ChatService,
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

  async getRestaurantDetail(
    dto: RestaurantDetailRequestDto,
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

    const userId = this.resolveTestUserId(dto.user_id);
    let selectedIds: number[] = [];

    try {
      selectedIds = await this.chatService.recommendRestaurantMenuIds({
        userId,
        restaurantName: restaurant.name,
        restaurantCategory: restaurant.category,
        filter: dto.filter ?? null,
        menus: menus.map((menu) => this.toRecommendationInput(menu)),
      });
    } catch (error) {
      console.error('[RESTAURANT] Gemini recommendation failed; fallback used', {
        restaurantId: restaurant.id,
        userId,
        filter: dto.filter ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const selectedMenus = this.selectRecommendedMenus(
      menus,
      selectedIds,
      dto.filter ?? null,
    );

    return {
      restaurant_name: restaurant.name,
      menu_list: selectedMenus.map((menu) => this.toResponse(menu)),
    };
  }

  private resolveTestUserId(requestUserId?: number | null): number | null {
    if (requestUserId != null) {
      return requestUserId;
    }

    const configured = Number(process.env.RESTAURANT_TEST_USER_ID);
    return Number.isInteger(configured) && configured > 0 ? configured : null;
  }

  private selectRecommendedMenus(
    menus: RestaurantMenuEntity[],
    selectedIds: number[],
    filter: RestaurantMenuFilter | null,
  ): RestaurantMenuEntity[] {
    const menuById = new Map(menus.map((menu) => [menu.id, menu]));
    const selected = selectedIds
      .map((id) => menuById.get(id))
      .filter((menu): menu is RestaurantMenuEntity => menu != null);

    if (selected.length > 0) {
      return selected.slice(0, this.recommendationLimit);
    }

    return this.fallbackRecommendations(menus, filter).slice(
      0,
      this.recommendationLimit,
    );
  }

  private fallbackRecommendations(
    menus: RestaurantMenuEntity[],
    filter: RestaurantMenuFilter | null,
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
      weight: this.numberValue(menu.weight),
      unit_quantity: menu.unitQuantity,
    };
  }

  private toResponse(menu: RestaurantMenuEntity): RestaurantMenuResponseDto {
    return {
      menu_id: menu.id,
      menu_name: menu.name,
      calories: this.numberValue(menu.calories),
      carbs: this.nullableNumber(menu.carbs),
      protein: this.nullableNumber(menu.protein),
      fat: this.nullableNumber(menu.fat),
      unit: menu.unit,
      weight: this.numberValue(menu.weight),
      unit_quantity: menu.unitQuantity,
    };
  }

  private normalizeSearchText(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '');
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
