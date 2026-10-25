import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { HomeService } from './home.service';
import { UserEntity } from '../auth/entity/user/user.entity';

describe('HomeService menu ownership', () => {
  const user = { id: 1 } as UserEntity;
  let service: any;
  let query: any;

  // 공용 메뉴(10)와 본인 메뉴(11)만 조회되고, 다른 사용자의 개인 메뉴(99)는 조회 결과에 없는 상황
  function mockAccessibleMenus(menus: { id: number }[]) {
    query = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(menus),
    };
    service.menuRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(query),
    };
  }

  beforeEach(() => {
    service = Object.create(HomeService.prototype);
    service.mealRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    service.mealMenuRepository = { create: jest.fn((value) => value) };
    service.folderRepository = { manager: { transaction: jest.fn() } };
    service.menuSetRepository = { manager: { transaction: jest.fn() } };
  });

  it('limits accessible menus to public menus and the user own menus', async () => {
    mockAccessibleMenus([{ id: 10 }]);

    await service.findAccessibleMenus(user, [10]);

    const brackets = query.andWhere.mock.calls
      .map(([condition]) => condition)
      .find((condition) => condition instanceof Brackets);
    const nested = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
    };
    brackets.whereFactory(nested);

    expect(nested.where).toHaveBeenCalledWith('user.id IS NULL');
    expect(nested.orWhere).toHaveBeenCalledWith('user.id = :userId', {
      userId: 1,
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      'menu.is_deleted = :isDeleted',
      { isDeleted: 0 },
    );
  });

  it('rejects another user menu in registerMeal with the existing error', async () => {
    mockAccessibleMenus([{ id: 10 }]);

    await expect(
      service.registerMeal(user, {
        date: '2026-10-25',
        time: '12:00',
        menu_ids: [10, 99],
        menu_quantities: [100, 100],
        menu_input_modes: [0, 0],
      }),
    ).rejects.toThrow(new BadRequestException('Some menu_ids do not exist'));
    expect(service.mealRepository.save).not.toHaveBeenCalled();
  });

  it('registers a meal with public and own menus', async () => {
    mockAccessibleMenus([{ id: 10 }, { id: 11 }]);

    await service.registerMeal(user, {
      date: '2026-10-25',
      time: '12:00',
      menu_ids: [10, 11],
      menu_quantities: [100, 50],
      menu_input_modes: [0, 0],
    });

    expect(service.mealRepository.save).toHaveBeenCalled();
  });

  it.each([
    ['upsertFolder', 'folderRepository', { folder_name: '폴더' }],
    ['upsertMenuSet', 'menuSetRepository', { set_name: '세트' }],
  ])(
    'rejects another user menu in %s with the existing error',
    async (method, repository, nameField) => {
      mockAccessibleMenus([{ id: 10 }]);

      await expect(
        service[method](user, {
          ...nameField,
          menu_ids: [10, 99],
          menu_quantities: [100, 100],
          menu_input_modes: [0, 0],
        }),
      ).rejects.toThrow(new NotFoundException('Menu not found'));
      expect(service[repository].manager.transaction).not.toHaveBeenCalled();
    },
  );
});
