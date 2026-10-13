import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { MenuEntity } from '../home/entity/menu.entity';
import { stripPublicMenuSourcePrefix } from '../utils/menu-name.util';
import { RestaurantSearchRequestDto } from './dto/request-dto/restaurant-search-request-dto';
import {
  RestaurantDetailRequestDto,
  RestaurantMenuFilter,
} from './dto/request-dto/restaurant-detail-request-dto';
import {
  RestaurantSearchResponseDto,
  RestaurantSummaryResponseDto,
} from './dto/response-dto/restaurant-search-response-dto';
import {
  RestaurantDetailResponseDto,
  RestaurantMenuResponseDto,
} from './dto/response-dto/restaurant-detail-response-dto';

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(MenuEntity)
    private readonly menuRepository: Repository<MenuEntity>,
  ) {}

  async searchRestaurants(
    dto: RestaurantSearchRequestDto,
  ): Promise<RestaurantSearchResponseDto> {
    const input = dto.input.trim();
    const query = this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'owner')
      .select('MIN(menu.id)', 'restaurant_id')
      .addSelect('TRIM(menu.brand)', 'restaurant_name')
      .where('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere('owner.id IS NULL')
      .andWhere('menu.brand IS NOT NULL')
      .andWhere("TRIM(menu.brand) <> ''")
      .groupBy('TRIM(menu.brand)')
      .orderBy('MIN(menu.id)', 'ASC')
      .limit(dto.limit + 1);

    if (input) {
      query.andWhere('INSTR(LOWER(menu.brand), LOWER(:input)) > 0', {
        input,
      });
    }

    if (dto.cursor != null) {
      query.having('MIN(menu.id) > :cursor', { cursor: dto.cursor });
    }

    const rows = await query.getRawMany<{
      restaurant_id: number | string;
      restaurant_name: string;
    }>();

    const hasNext = rows.length > dto.limit;
    const pageRows = hasNext ? rows.slice(0, dto.limit) : rows;
    const categoryByBrand = await this.findRepresentativeCategories(
      pageRows.map((row) => row.restaurant_name),
    );
    const restaurantList: RestaurantSummaryResponseDto[] = pageRows.map(
      (row) => ({
        restaurant_id: Number(row.restaurant_id),
        restaurant_name: row.restaurant_name,
        category: categoryByBrand.get(row.restaurant_name) ?? null,
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
    const restaurant = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'owner')
      .select(['menu.id', 'menu.brand'])
      .where('menu.id = :restaurantId', {
        restaurantId: dto.restaurant_id,
      })
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere('owner.id IS NULL')
      .andWhere('menu.brand IS NOT NULL')
      .andWhere("TRIM(menu.brand) <> ''")
      .getOne();

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const restaurantName = restaurant.brand.trim();
    const menuQuery = this.createRestaurantMenuQuery(restaurantName);
    this.applyMenuFilter(menuQuery, dto.filter ?? null);
    const menus = await menuQuery.getMany();

    return {
      restaurant_name: restaurantName,
      menu_list: menus.map(
        (menu): RestaurantMenuResponseDto => ({
          menu_id: menu.id,
          menu_name: stripPublicMenuSourcePrefix(menu.name),
          calories: menu.calories,
          carbs: menu.carbs ?? null,
          protein: menu.protein ?? null,
          fat: menu.fat ?? null,
          unit: menu.unit,
          weight: menu.weight,
          unit_quantity: menu.unit_quantity,
        }),
      ),
    };
  }

  private createRestaurantMenuQuery(
    brand: string,
  ): SelectQueryBuilder<MenuEntity> {
    return this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'owner')
      .where('TRIM(menu.brand) = :brand', { brand })
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere('owner.id IS NULL');
  }

  private async findRepresentativeCategories(
    brands: string[],
  ): Promise<Map<string, string>> {
    const categoryByBrand = new Map<string, string>();
    if (brands.length === 0) {
      return categoryByBrand;
    }

    const rows = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'owner')
      .select('TRIM(menu.brand)', 'restaurant_name')
      .addSelect('TRIM(menu.category)', 'category')
      .addSelect('COUNT(*)', 'category_count')
      .where('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere('owner.id IS NULL')
      .andWhere('TRIM(menu.brand) IN (:...brands)', { brands })
      .andWhere('menu.category IS NOT NULL')
      .andWhere("TRIM(menu.category) <> ''")
      .groupBy('TRIM(menu.brand)')
      .addGroupBy('TRIM(menu.category)')
      .orderBy('TRIM(menu.brand)', 'ASC')
      .addOrderBy('COUNT(*)', 'DESC')
      .addOrderBy('TRIM(menu.category)', 'ASC')
      .getRawMany<{
        restaurant_name: string;
        category: string;
        category_count: number | string;
      }>();

    for (const row of rows) {
      if (!categoryByBrand.has(row.restaurant_name)) {
        categoryByBrand.set(row.restaurant_name, row.category);
      }
    }
    return categoryByBrand;
  }

  private applyMenuFilter(
    query: SelectQueryBuilder<MenuEntity>,
    filter: RestaurantMenuFilter | null,
  ): void {
    if (filter === RestaurantMenuFilter.BALANCED) {
      const macroCalories =
        '(COALESCE(menu.carbs, 0) * 4 + COALESCE(menu.protein, 0) * 4 + COALESCE(menu.fat, 0) * 9)';
      const balanceDistance =
        `ABS(COALESCE(menu.carbs, 0) * 4 / NULLIF(${macroCalories}, 0) - 0.5) + ` +
        `ABS(COALESCE(menu.protein, 0) * 4 / NULLIF(${macroCalories}, 0) - 0.2) + ` +
        `ABS(COALESCE(menu.fat, 0) * 9 / NULLIF(${macroCalories}, 0) - 0.3)`;

      query
        .andWhere(`${macroCalories} > 0`)
        .orderBy(balanceDistance, 'ASC')
        .addOrderBy('menu.id', 'ASC');
      return;
    }

    if (filter === RestaurantMenuFilter.LOW_CALORIE) {
      query
        .andWhere('menu.calories IS NOT NULL')
        .orderBy('menu.calories', 'ASC')
        .addOrderBy('menu.id', 'ASC');
      return;
    }

    if (filter === RestaurantMenuFilter.PROTEIN) {
      query
        .andWhere('menu.protein IS NOT NULL')
        .orderBy('menu.protein', 'DESC')
        .addOrderBy('menu.calories', 'ASC')
        .addOrderBy('menu.id', 'ASC');
      return;
    }

    query.orderBy('menu.id', 'ASC');
  }
}
