import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { MenuEntity } from '../home/entity/menu.entity';
import { AsyncTtlCache } from '../utils/async-ttl-cache.util';
import { parseNullableNumber } from './food-image.util';
import { FoodImageMenuCandidate } from './food-image.types';

type FoodImageMenuRow = {
  ownerUserId: number | null;
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  weight: number | null;
  unit: number | null;
};

const DEFAULT_PUBLIC_MENU_CACHE_TTL_MS = 300000;

// 음식 사진 인식·메뉴 매칭에 쓰는 가벼운 메뉴 목록(공용 + 내 개인 메뉴).
// 공용 메뉴는 앱 전체에서 하나인 TTL 캐시에 두고, 개인 메뉴는 매번 DB에서 읽는다.
// 앱 안에서 공용 메뉴를 바꾸면 invalidatePublicMenus()를 부른다.
@Injectable()
export class FoodImageMenuCatalog {
  private readonly publicMenuCache = new AsyncTtlCache(
    () => this.loadMenus(null),
    () => this.getPublicMenuCacheTtlMs(),
  );

  constructor(
    @InjectRepository(MenuEntity)
    private readonly menuRepository: Repository<MenuEntity>,
  ) {}

  // 예전 단일 쿼리(공용 + 내 메뉴, ORDER BY menu.id)와 같은 순서로 합친다.
  // 돌려주는 원소는 캐시와 공유하므로 호출부는 원소를 수정하지 말고 복사해서 쓴다.
  async getCandidateMenus(userId: number): Promise<FoodImageMenuCandidate[]> {
    const [publicMenus, personalMenus] = await Promise.all([
      this.publicMenuCache.get(),
      this.loadMenus(userId),
    ]);
    const merged: FoodImageMenuCandidate[] = [];
    let publicIndex = 0;
    let personalIndex = 0;

    // 두 목록 모두 id 오름차순이므로 선형 병합한다.
    while (
      publicIndex < publicMenus.length ||
      personalIndex < personalMenus.length
    ) {
      if (
        personalIndex >= personalMenus.length ||
        (publicIndex < publicMenus.length &&
          publicMenus[publicIndex].id < personalMenus[personalIndex].id)
      ) {
        merged.push(publicMenus[publicIndex++]);
      } else {
        merged.push(personalMenus[personalIndex++]);
      }
    }

    return merged;
  }

  // menuIds 순서를 유지하고, 지워졌거나 남의 개인 메뉴인 id는 뺀다.
  async getMenusByIds(
    userId: number,
    menuIds: number[],
  ): Promise<FoodImageMenuCandidate[]> {
    if (menuIds.length === 0) {
      return [];
    }

    const rows = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'user')
      .select([
        'user.id AS ownerUserId',
        'menu.id AS id',
        'menu.name AS name',
        'menu.brand AS brand',
        'menu.category AS category',
        'menu.weight AS weight',
        'menu.unit AS unit',
      ])
      .where('menu.id IN (:...menuIds)', { menuIds })
      .andWhere(
        new Brackets((qb) => {
          qb.where('user.id IS NULL').orWhere('user.id = :userId', { userId });
        }),
      )
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .getRawMany<FoodImageMenuRow>();
    const menuMap = new Map(
      rows.map((row) => [Number(row.id), this.toCandidate(row)]),
    );

    return menuIds
      .map((menuId) => menuMap.get(menuId))
      .filter((menu): menu is FoodImageMenuCandidate => !!menu);
  }

  invalidatePublicMenus(): void {
    this.publicMenuCache.invalidate();
  }

  // ownerUserId가 null이면 공용 메뉴, 아니면 해당 사용자의 개인 메뉴만 읽는다.
  private async loadMenus(
    ownerUserId: number | null,
  ): Promise<FoodImageMenuCandidate[]> {
    const rows = await this.menuRepository
      .createQueryBuilder('menu')
      .leftJoin('menu.user', 'user')
      .select([
        'user.id AS ownerUserId',
        'menu.id AS id',
        'menu.name AS name',
        'menu.brand AS brand',
        'menu.category AS category',
        'menu.weight AS weight',
        'menu.unit AS unit',
      ])
      .where(ownerUserId === null ? 'user.id IS NULL' : 'user.id = :userId', {
        userId: ownerUserId,
      })
      .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
      .orderBy('menu.id', 'ASC')
      .getRawMany<FoodImageMenuRow>();

    return rows.map((row) => this.toCandidate(row));
  }

  private toCandidate(row: FoodImageMenuRow): FoodImageMenuCandidate {
    return {
      ...row,
      id: Number(row.id),
      weight: parseNullableNumber(row.weight),
      unit: parseNullableNumber(row.unit),
    };
  }

  private getPublicMenuCacheTtlMs(): number {
    const parsed = Number(
      process.env.FOOD_IMAGE_PUBLIC_MENU_CACHE_TTL_MS ??
        DEFAULT_PUBLIC_MENU_CACHE_TTL_MS,
    );

    if (!Number.isFinite(parsed)) {
      return DEFAULT_PUBLIC_MENU_CACHE_TTL_MS;
    }

    return Math.max(parsed, 0);
  }
}
