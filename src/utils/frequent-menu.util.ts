import { Brackets, Repository } from 'typeorm';
import { MealMenuEntity } from '../home/entity/meal-menu.entity';

export async function getFrequentlyRecordedMenuIds(
  repository: Repository<MealMenuEntity>,
  userId: number,
): Promise<number[]> {
  const rows = await repository
    .createQueryBuilder('mealMenu')
    .innerJoin('mealMenu.meal', 'meal')
    .innerJoin('mealMenu.menu', 'menu')
    .where('meal.userId = :userId', { userId })
    .andWhere('menu.is_deleted = :isDeleted', { isDeleted: 0 })
    .andWhere(
      new Brackets((qb) => {
        qb.where('menu.userId IS NULL').orWhere('menu.userId = :userId', {
          userId,
        });
      }),
    )
    .select('menu.id', 'menu_id')
    .addSelect('COUNT(mealMenu.id)', 'record_count')
    .addSelect('MAX(meal.updatedAt)', 'last_recorded_at')
    .groupBy('menu.id')
    .orderBy('record_count', 'DESC')
    .addOrderBy('last_recorded_at', 'DESC')
    .addOrderBy('menu.id', 'ASC')
    .limit(20)
    .getRawMany<{ menu_id: number | string }>();

  return rows.map((row) => Number(row.menu_id));
}
