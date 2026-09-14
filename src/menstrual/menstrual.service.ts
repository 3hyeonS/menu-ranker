import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../auth/entity/user/user.entity';
import { GetMenstrualRecordsRequestDto } from './dto/request-dto/get-menstrual-records-request.dto';
import {
  MenstrualDateRangeRequestDto,
  SaveMenstrualRecordsRequestDto,
} from './dto/request-dto/save-menstrual-records-request.dto';
import {
  MenstrualDateRange,
  MenstrualRecordsResponseDto,
} from './dto/response-dto/menstrual-records-response.dto';
import { MenstrualCycleEntity } from './entity/menstrual-cycle.entity';
import { MenstrualRecordEntity } from './entity/menstrual-record.entity';

@Injectable()
export class MenstrualService {
  private static readonly MAX_DATES_PER_SAVE = 10_000;

  constructor(
    @InjectRepository(MenstrualCycleEntity)
    private readonly cycleRepository: Repository<MenstrualCycleEntity>,
    @InjectRepository(MenstrualRecordEntity)
    private readonly recordRepository: Repository<MenstrualRecordEntity>,
  ) {}

  async getRecords(
    user: UserEntity,
    request: GetMenstrualRecordsRequestDto,
  ): Promise<MenstrualRecordsResponseDto> {
    this.assertValidRange(request.from_date, request.to_date);
    const records = await this.recordRepository.find({
      where: {
        user: { id: user.id },
        menstruationStatus: '있음',
      },
      select: { date: true },
      order: { date: 'ASC' },
    });
    const allRanges = this.groupConsecutiveDates(
      records.map((record) => record.date),
    );
    const recordedRanges = allRanges.filter(
      (range) =>
        range.start_date <= request.to_date &&
        range.end_date >= request.from_date,
    );
    const hasOlder = allRanges.some(
      (range) => range.end_date < request.from_date,
    );
    return new MenstrualRecordsResponseDto(recordedRanges, hasOlder);
  }

  async saveRecords(
    user: UserEntity,
    request: SaveMenstrualRecordsRequestDto,
  ): Promise<void> {
    const addDates = this.expandRanges(request.add_ranges, 'add_ranges');
    const removeDates = this.expandRanges(
      request.remove_ranges,
      'remove_ranges',
    );
    if (
      addDates.size + removeDates.size >
      MenstrualService.MAX_DATES_PER_SAVE
    ) {
      throw new BadRequestException('Too many menstrual record dates');
    }
    if (addDates.size === 0 && removeDates.size === 0) {
      return;
    }

    await this.cycleRepository.manager.transaction(async (manager) => {
      await manager.getRepository(UserEntity).findOne({
        where: { id: user.id },
        select: { id: true },
        lock: { mode: 'pessimistic_write' },
      });
      const recordRepository = manager.getRepository(MenstrualRecordEntity);
      const cycleRepository = manager.getRepository(MenstrualCycleEntity);
      const existingRecords = await recordRepository.find({
        where: { user: { id: user.id }, menstruationStatus: '있음' },
        select: { date: true },
      });
      const resultingDates = new Set(
        existingRecords.map((record) => record.date),
      );
      removeDates.forEach((date) => resultingDates.delete(date));
      addDates.forEach((date) => resultingDates.add(date));

      await recordRepository.delete({ user: { id: user.id } });
      await cycleRepository.delete({ user: { id: user.id } });
      const referenceDate = this.getKoreanDateString();

      for (const range of this.groupConsecutiveDates([...resultingDates])) {
        const cycle = await cycleRepository.save(
          cycleRepository.create({
            startDate: range.start_date,
            endDate: range.end_date,
            isEnd: range.end_date < referenceDate,
            user,
          }),
        );
        await recordRepository.save(
          this.expandRange(range.start_date, range.end_date).map((date) =>
            recordRepository.create({
              date,
              menstruationStatus: '있음',
              flow: null,
              symptoms: null,
              cycle,
              user,
            }),
          ),
        );
      }
    });
  }

  private expandRanges(
    ranges: MenstrualDateRangeRequestDto[],
    fieldName: 'add_ranges' | 'remove_ranges',
  ): Set<string> {
    const dates = new Set<string>();
    for (const range of ranges) {
      try {
        this.assertValidRange(range.start_date, range.end_date);
      } catch {
        throw new BadRequestException(
          `${fieldName} must contain valid date ranges`,
        );
      }
      for (const date of this.expandRange(range.start_date, range.end_date)) {
        dates.add(date);
        if (dates.size > MenstrualService.MAX_DATES_PER_SAVE) {
          throw new BadRequestException('Too many menstrual record dates');
        }
      }
    }
    return dates;
  }

  private expandRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    for (let date = startDate; date <= endDate; date = this.addDays(date, 1)) {
      dates.push(date);
    }
    return dates;
  }

  private groupConsecutiveDates(dates: string[]): MenstrualDateRange[] {
    const sortedDates = [...new Set(dates)].sort();
    const ranges: MenstrualDateRange[] = [];
    for (const date of sortedDates) {
      const current = ranges[ranges.length - 1];
      if (current && this.addDays(current.end_date, 1) === date) {
        current.end_date = date;
      } else {
        ranges.push({ start_date: date, end_date: date });
      }
    }
    return ranges;
  }

  private assertValidRange(startDate: string, endDate: string): void {
    this.assertValidDate(startDate);
    this.assertValidDate(endDate);
    if (startDate > endDate) {
      throw new BadRequestException(
        'start_date must be earlier than or equal to end_date',
      );
    }
  }

  private assertValidDate(date: string): void {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      throw new BadRequestException('date must be a valid YYYY-MM-DD date');
    }
  }

  private addDays(date: string, amount: number): string {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    parsed.setUTCDate(parsed.getUTCDate() + amount);
    return parsed.toISOString().slice(0, 10);
  }

  private getKoreanDateString(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
  }
}
