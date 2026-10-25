import { PutObjectCommand } from '@aws-sdk/client-s3';
import { QueryFailedError } from 'typeorm';
import { HomeService } from './home.service';
import { MealEntity } from './entity/meal.entity';
import { MealMenuEntity } from './entity/meal-menu.entity';
import { MealSetEntity } from './entity/meal-set.entity';

const duplicateEntryError = () =>
  new QueryFailedError(
    'INSERT',
    [],
    Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }),
  );

const user = { id: 7 } as any;

// 트랜잭션 콜백에 넘길 EntityManager와 그 안의 리포지토리 mock
function createMealTransaction(existingMeal: any = null) {
  const txMealRepository = {
    findOne: jest.fn().mockResolvedValue(existingMeal),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const txMealMenuRepository = {
    remove: jest.fn(),
    create: jest.fn((value) => ({ ...value })),
  };
  const txMealSetRepository = {
    remove: jest.fn(),
    create: jest.fn((value) => ({ ...value })),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === MealEntity) return txMealRepository;
      if (entity === MealMenuEntity) return txMealMenuRepository;
      if (entity === MealSetEntity) return txMealSetRepository;
      throw new Error('unexpected repository');
    }),
  };

  return {
    manager,
    txMealRepository,
    txMealMenuRepository,
    txMealSetRepository,
  };
}

function createService() {
  const service = Object.create(HomeService.prototype) as any;
  service.mealMenuRepository = { create: jest.fn((value) => value) };
  service.mealSetRepository = { create: jest.fn((value) => value) };
  const menuQuery = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([{ id: 1, name: '현미밥' }]),
  };
  service.menuRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(menuQuery),
  };
  return service;
}

describe('HomeService data bug fixes', () => {
  describe('registerMeal', () => {
    it('writes a new meal through the transaction repositories', async () => {
      const service = createService();
      const tx = createMealTransaction();
      service.mealRepository = {
        save: jest.fn(),
        manager: { transaction: jest.fn((work) => work(tx.manager)) },
      };

      await service.registerMeal(user, {
        date: '2026-10-25',
        time: 1,
        image: 'https://bucket/meal.jpg',
        menu_ids: [1],
        menu_quantities: [210.04],
        menu_input_modes: [1],
      });

      expect(service.mealRepository.manager.transaction).toHaveBeenCalledTimes(
        1,
      );
      expect(service.mealRepository.save).not.toHaveBeenCalled();
      expect(tx.txMealRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-10-25',
          time: 1,
          image: 'https://bucket/meal.jpg',
          mealMenus: [
            expect.objectContaining({ quantity: 210, menu_input_mode: 1 }),
          ],
          mealSets: [],
          user,
        }),
      );
    });

    it('removes old menus and saves the replacement in the same transaction', async () => {
      const service = createService();
      const oldMenus = [{ id: 11 }];
      const oldSets = [{ id: 12 }];
      const existingMeal = {
        id: 3,
        image: 'old.jpg',
        mealTime: '08:00',
        mealMenus: oldMenus,
        mealSets: oldSets,
      };
      const tx = createMealTransaction(existingMeal);
      service.mealRepository = {
        manager: { transaction: jest.fn((work) => work(tx.manager)) },
      };

      await service.registerMeal(user, {
        date: '2026-10-25',
        time: 0,
        meal_time: '09:10',
      });

      expect(tx.txMealRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(tx.txMealMenuRepository.remove).toHaveBeenCalledWith(oldMenus);
      expect(tx.txMealSetRepository.remove).toHaveBeenCalledWith(oldSets);
      expect(tx.txMealRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 3,
          image: null,
          mealTime: '09:10',
          mealMenus: [],
          mealSets: [],
        }),
      );
    });

    it('propagates a failed save so the transaction rolls back', async () => {
      const service = createService();
      const tx = createMealTransaction({
        id: 3,
        mealMenus: [{ id: 11 }],
        mealSets: [],
      });
      tx.txMealRepository.save.mockRejectedValue(new Error('db down'));
      service.mealRepository = {
        manager: { transaction: jest.fn((work) => work(tx.manager)) },
      };

      await expect(
        service.registerMeal(user, { date: '2026-10-25', time: 0 }),
      ).rejects.toThrow('db down');
      expect(service.mealRepository.manager.transaction).toHaveBeenCalledTimes(
        1,
      );
    });

    it('retries once and updates the row a concurrent request inserted', async () => {
      const service = createService();
      const first = createMealTransaction();
      first.txMealRepository.save.mockRejectedValue(duplicateEntryError());
      const second = createMealTransaction({
        id: 9,
        mealMenus: [],
        mealSets: [],
      });
      service.mealRepository = {
        manager: {
          transaction: jest
            .fn()
            .mockImplementationOnce((work) => work(first.manager))
            .mockImplementationOnce((work) => work(second.manager)),
        },
      };

      await service.registerMeal(user, { date: '2026-10-25', time: 2 });

      expect(service.mealRepository.manager.transaction).toHaveBeenCalledTimes(
        2,
      );
      expect(second.txMealRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 9 }),
      );
    });
  });

  describe('registerWeight / registerSteps', () => {
    it('updates the existing row after a duplicate-key race', async () => {
      const service = createService();
      const existing = { id: 5, weight: null, steps: 3000 };
      service.weightStepsRepository = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existing),
        create: jest.fn((value) => value),
        save: jest
          .fn()
          .mockRejectedValueOnce(duplicateEntryError())
          .mockResolvedValue(undefined),
      };

      await service.registerWeight(user, { date: '2026-10-25', weight: 61.24 });

      expect(service.weightStepsRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 5, weight: 61.2, steps: 3000 }),
      );
    });

    it('updates steps on an existing row instead of inserting', async () => {
      const service = createService();
      const existing = { id: 5, weight: 61.2, steps: null };
      service.weightStepsRepository = {
        findOne: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
        save: jest.fn(),
      };

      await service.registerSteps(user, { date: '2026-10-25', steps: 8000 });

      expect(service.weightStepsRepository.create).not.toHaveBeenCalled();
      expect(service.weightStepsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, steps: 8000 }),
      );
    });
  });

  describe('uploadMealImage', () => {
    it('uploads without deleting when no meal exists for the slot yet', async () => {
      const service = createService();
      service.bucketName = 'bucket';
      service.s3 = { send: jest.fn().mockResolvedValue({}) };
      service.mealRepository = { findOne: jest.fn().mockResolvedValue(null) };

      const url = await service.uploadMealImage(
        user,
        { buffer: Buffer.from('x'), mimetype: 'image/jpeg' },
        { date: '2026-10-25', time: 0 },
      );

      expect(service.s3.send).toHaveBeenCalledTimes(1);
      expect(service.s3.send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
      expect(url).toContain('meal/7/2026-10-25/0/');
    });
  });

  describe('mapCsvRow', () => {
    it('maps 불포화지방 and 포화지방 columns to their own fields', () => {
      const service = createService();

      expect(
        service.mapCsvRow(
          ['메뉴', '포화지방(g)', '불포화지방(g)', '트랜스 지방(g)', '지방(g)'],
          ['현미밥', '1.1', '2.2', '0.1', '4.4'],
        ),
      ).toEqual(
        expect.objectContaining({
          name: '현미밥',
          sat_fat: '1.1',
          un_sat_fat: '2.2',
          trans_fat: '0.1',
          fat: '4.4',
        }),
      );
    });
  });

  describe('asUnit', () => {
    it('recognizes a gram unit written right after the number', () => {
      const service = createService();

      expect(service.asUnit('100g')).toBe(0);
      expect(service.asUnit(undefined, '총 내용량 250g')).toBe(0);
      expect(service.asUnit('200mL')).toBe(1);
      expect(() => service.asUnit('1kg')).toThrow();
    });
  });
  describe('callGeminiJsonWithImage', () => {
    const envKeys = [
      'GEMINI_API_KEY',
      'GEMINI_BASE_URL',
      'GEMINI_IMAGE_BASE_URL',
      'GEMINI_IMAGE_MODEL',
      'GEMINI_IMAGE_FALLBACK_MODELS',
      'GEMINI_IMAGE_FALLBACK_MODEL',
    ];
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      envKeys.forEach((key) => {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      });
    });

    afterEach(() => {
      envKeys.forEach((key) => {
        if (savedEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = savedEnv[key];
        }
      });
    });

    it('calls the fallback model even when GEMINI_BASE_URL is set', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.GEMINI_BASE_URL =
        'https://proxy.example.com/v1beta/models/{model}:generateContent';
      process.env.GEMINI_IMAGE_MODEL = 'primary-model';
      process.env.GEMINI_IMAGE_FALLBACK_MODELS = 'fallback-model';
      const service = createService();
      service.postGeminiImageJson = jest
        .fn()
        .mockRejectedValueOnce({ response: { status: 429 } })
        .mockResolvedValueOnce({ ok: true });

      await expect(
        service.callGeminiJsonWithImage('prompt', {} as any),
      ).resolves.toEqual({ ok: true });

      const calledUrls = service.postGeminiImageJson.mock.calls.map(
        (call: unknown[]) => call[3],
      );
      expect(calledUrls).toEqual([
        'https://proxy.example.com/v1beta/models/primary-model:generateContent',
        'https://proxy.example.com/v1beta/models/fallback-model:generateContent',
      ]);
    });
  });
});
