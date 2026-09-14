import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from '../auth/entity/user/user.entity';
import { MenstrualCycleEntity } from './entity/menstrual-cycle.entity';
import { MenstrualRecordEntity } from './entity/menstrual-record.entity';
import { MenstrualService } from './menstrual.service';

describe('MenstrualService', () => {
  const user = { id: 7 } as UserEntity;

  function createFixture() {
    let nextCycleId = 1;
    const cycleRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: nextCycleId++ })),
      delete: jest.fn(),
    };
    const recordRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn(),
      delete: jest.fn(),
    };
    const userRepository = {
      findOne: jest.fn(async () => ({ id: user.id })),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === MenstrualCycleEntity) return cycleRepository;
        if (entity === MenstrualRecordEntity) return recordRepository;
        return userRepository;
      }),
    };
    const transaction = jest.fn(async (work) => work(manager));
    Object.assign(cycleRepository, { manager: { transaction } });
    const service = new MenstrualService(
      cycleRepository as unknown as Repository<MenstrualCycleEntity>,
      recordRepository as unknown as Repository<MenstrualRecordEntity>,
    );
    return { service, cycleRepository, recordRepository, transaction };
  }

  it('returns full recorded ranges crossing the requested month boundary', async () => {
    const { service, recordRepository } = createFixture();
    recordRepository.find.mockResolvedValue(
      [
        '2026-06-01',
        '2026-06-02',
        '2026-07-29',
        '2026-07-30',
        '2026-07-31',
        '2026-08-01',
        '2026-08-02',
        '2026-08-20',
        '2026-08-30',
        '2026-08-31',
        '2026-09-01',
        '2026-09-02',
      ].map((date) => ({ date })),
    );

    const result = await service.getRecords(user, {
      from_date: '2026-08-01',
      to_date: '2026-08-31',
    });

    expect(result).toEqual({
      recorded_ranges: [
        { start_date: '2026-07-29', end_date: '2026-08-02' },
        { start_date: '2026-08-20', end_date: '2026-08-20' },
        { start_date: '2026-08-30', end_date: '2026-09-02' },
      ],
      has_older: true,
    });
  });

  it('returns an empty range list without inventing records', async () => {
    const { service, recordRepository } = createFixture();
    recordRepository.find.mockResolvedValue([]);

    await expect(
      service.getRecords(user, {
        from_date: '2026-08-01',
        to_date: '2026-08-31',
      }),
    ).resolves.toEqual({ recorded_ranges: [], has_older: false });
  });

  it('applies removals and additions, then rebuilds consecutive ranges', async () => {
    const { service, cycleRepository, recordRepository, transaction } =
      createFixture();
    recordRepository.find.mockResolvedValue(
      ['2026-08-01', '2026-08-02', '2026-08-03'].map((date) => ({ date })),
    );

    await service.saveRecords(user, {
      add_ranges: [{ start_date: '2026-08-05', end_date: '2026-08-06' }],
      remove_ranges: [{ start_date: '2026-08-02', end_date: '2026-08-02' }],
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(recordRepository.delete).toHaveBeenCalledWith({
      user: { id: user.id },
    });
    expect(cycleRepository.delete).toHaveBeenCalledWith({
      user: { id: user.id },
    });
    expect(cycleRepository.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        startDate: '2026-08-01',
        endDate: '2026-08-01',
        isEnd: true,
      }),
    );
    expect(cycleRepository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        startDate: '2026-08-03',
        endDate: '2026-08-03',
        isEnd: true,
      }),
    );
    expect(cycleRepository.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        startDate: '2026-08-05',
        endDate: '2026-08-06',
        isEnd: true,
      }),
    );
    expect(recordRepository.create).toHaveBeenCalledTimes(4);
  });

  it('does not mark a menstrual range recorded through today as ended', async () => {
    const { service, cycleRepository, recordRepository } = createFixture();
    recordRepository.find.mockResolvedValue([]);
    jest
      .spyOn(service as any, 'getKoreanDateString')
      .mockReturnValue('2026-09-15');

    await service.saveRecords(user, {
      add_ranges: [{ start_date: '2026-09-14', end_date: '2026-09-15' }],
      remove_ranges: [],
    });

    expect(cycleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-09-14',
        endDate: '2026-09-15',
        isEnd: false,
      }),
    );
  });

  it('rejects an invalid or reversed date range', async () => {
    const { service } = createFixture();

    await expect(
      service.getRecords(user, {
        from_date: '2026-08-31',
        to_date: '2026-08-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.saveRecords(user, {
        add_ranges: [{ start_date: '2026-02-30', end_date: '2026-03-01' }],
        remove_ranges: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
