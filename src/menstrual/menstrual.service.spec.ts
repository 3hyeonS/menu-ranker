import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from '../auth/entity/user/user.entity';
import { MenstrualCycleEntity } from './entity/menstrual-cycle.entity';
import { MenstrualRecordEntity } from './entity/menstrual-record.entity';
import { MenstrualService } from './menstrual.service';

describe('MenstrualService', () => {
  const user = { id: 7 } as UserEntity;

  function createFixture() {
    const cycleRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(),
    };
    const recordRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === MenstrualCycleEntity ? cycleRepository : recordRepository,
      ),
    };
    const transaction = jest.fn(async (work) => work(manager));

    const service = new MenstrualService(
      {
        manager: { transaction },
      } as unknown as Repository<MenstrualCycleEntity>,
      {
        manager: { transaction },
      } as unknown as Repository<MenstrualRecordEntity>,
    );

    return { service, cycleRepository, recordRepository, manager };
  }

  it('creates a new cycle and its first present record', async () => {
    const { service, cycleRepository, recordRepository } = createFixture();
    recordRepository.findOne.mockResolvedValue(null);
    cycleRepository.save.mockImplementation(async (cycle) => ({
      ...cycle,
      id: 31,
    }));

    const result = await service.createCycle(user, {
      date: '2026-08-17',
      flow: '보통',
      symptoms: ['복통', '복통', ' 두통 '],
    });

    expect(result.cycle).toEqual({
      cycle_id: 31,
      start_date: '2026-08-17',
      end_date: '2026-08-17',
      is_end: false,
    });
    expect(recordRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-08-17',
        menstruationStatus: '있음',
        symptoms: ['복통', '두통'],
      }),
    );
  });

  it('ends a cycle on the prior day when an absent record is created', async () => {
    const { service, cycleRepository, recordRepository } = createFixture();
    const cycle = {
      id: 31,
      startDate: '2026-08-17',
      endDate: '2026-08-20',
      isEnd: false,
      user,
    } as MenstrualCycleEntity;
    cycleRepository.findOne.mockResolvedValue(cycle);
    recordRepository.findOne.mockResolvedValue(null);

    const result = await service.createRecord(user, {
      cycle_id: 31,
      date: '2026-08-21',
      menstruation_status: '없음',
      flow: '많음',
      symptoms: ['복통'],
    });

    expect(cycle.endDate).toBe('2026-08-20');
    expect(cycle.isEnd).toBe(true);
    expect(recordRepository.delete).toHaveBeenCalledWith({
      cycle: { id: 31 },
      date: expect.anything(),
    });
    expect(result.record).toEqual(
      expect.objectContaining({
        date: '2026-08-21',
        menstruation_status: '없음',
        flow: null,
        symptoms: null,
        cycle_id: 31,
      }),
    );
  });

  it('rejects a non-existent calendar date', async () => {
    const { service } = createFixture();

    await expect(
      service.createCycle(user, { date: '2026-02-30' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow an absent record on the cycle start date', async () => {
    const { service, cycleRepository, recordRepository } = createFixture();
    cycleRepository.findOne.mockResolvedValue({
      id: 31,
      startDate: '2026-08-17',
      endDate: '2026-08-17',
      isEnd: false,
      user,
    });
    recordRepository.findOne.mockResolvedValue(null);

    await expect(
      service.createRecord(user, {
        cycle_id: 31,
        date: '2026-08-17',
        menstruation_status: '없음',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
