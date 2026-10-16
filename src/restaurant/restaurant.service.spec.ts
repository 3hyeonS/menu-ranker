import { RestaurantService } from './restaurant.service';
import { RestaurantMenuEntity } from './entity/restaurant-menu.entity';

describe('RestaurantService', () => {
  it('returns sugars and saturated fat in restaurant menu details', () => {
    const service = new RestaurantService(null, null, null);
    const menu = {
      id: 1,
      name: '테스트 메뉴',
      calories: '250',
      carbs: '42.1',
      sugars: '6.2',
      protein: '12.3',
      fat: '8.4',
      satFat: '3.1',
      unit: 0,
      weight: '100',
      unitQuantity: '1인분',
    } as unknown as RestaurantMenuEntity;

    const response = (
      service as unknown as {
        toResponse(menu: RestaurantMenuEntity): Record<string, unknown>;
      }
    ).toResponse(menu);

    expect(response).toEqual({
      menu_id: 1,
      menu_name: '테스트 메뉴',
      calories: 250,
      sugars: 6.2,
      protein: 12.3,
      sat_fat: 3.1,
      unit: 0,
      weight: 100,
      unit_quantity: '1인분',
    });
    expect(response).not.toHaveProperty('carbs');
    expect(response).not.toHaveProperty('fat');
  });
});
