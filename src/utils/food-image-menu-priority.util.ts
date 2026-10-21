import {
  canonicalizeMenuSearchName,
  normalizeMenuSearchName,
} from './menu-name.util';

export type FoodImageMenuPriority = {
  id: number;
  name: string;
  brand: string | null;
  ownerUserId?: number | null;
  frequentRank?: number;
};

// Ownership is populated only from candidates already scoped to the current user.
const comparePriority = (a: FoodImageMenuPriority, b: FoodImageMenuPriority) =>
  Number(b.ownerUserId != null) - Number(a.ownerUserId != null) ||
  (a.frequentRank ?? Infinity) - (b.frequentRank ?? Infinity) ||
  a.id - b.id;

const sameFood = (a: FoodImageMenuPriority, b: FoodImageMenuPriority) =>
  canonicalizeMenuSearchName(a.name) === canonicalizeMenuSearchName(b.name) &&
  normalizeMenuSearchName(a.brand ?? '') ===
    normalizeMenuSearchName(b.brand ?? '');

const hasUserPriority = (menu: FoodImageMenuPriority) =>
  menu.ownerUserId != null || menu.frequentRank !== undefined;

export function preferUserFoodImageMenu<T extends FoodImageMenuPriority>(
  selected: T,
  candidates: T[],
): T {
  const preferred = candidates
    .filter((menu) => sameFood(selected, menu) && hasUserPriority(menu))
    .sort(comparePriority)[0];
  return preferred ?? selected;
}

// Replace equivalent public candidates before truncating the candidate list.
export function prioritizeUserFoodImageMenus<T extends FoodImageMenuPriority>(
  candidates: T[],
): T[] {
  const seen = new Set<number>();
  return candidates.flatMap((candidate) => {
    const preferred = preferUserFoodImageMenu(candidate, candidates);
    if (seen.has(preferred.id)) {
      return [];
    }
    seen.add(preferred.id);
    return [preferred];
  });
}
