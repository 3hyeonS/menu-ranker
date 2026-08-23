import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, Repository } from 'typeorm';
import { UserEntity } from '../auth/entity/user/user.entity';
import { CreateMenstrualCycleRequestDto } from './dto/request-dto/create-menstrual-cycle-request.dto';
import { CreateMenstrualRecordRequestDto } from './dto/request-dto/create-menstrual-record-request.dto';
import { GetMenstrualCyclesRequestDto } from './dto/request-dto/get-menstrual-cycles-request.dto';
import { MenstrualRecordFieldsDto } from './dto/request-dto/menstrual-record-fields.dto';
import {
  MenstrualCycleResponseDto,
  MenstrualCyclesResponseDto,
} from './dto/response-dto/menstrual-cycle-response.dto';
import { MenstrualRecordResponseDto } from './dto/response-dto/menstrual-record-response.dto';
import { MenstrualCycleEntity } from './entity/menstrual-cycle.entity';
import {
  MenstrualFlow,
  MenstrualRecordEntity,
} from './entity/menstrual-record.entity';

@Injectable()
export class MenstrualService {
  constructor(
    @InjectRepository(MenstrualCycleEntity)
    private readonly cycleRepository: Repository<MenstrualCycleEntity>,
    @InjectRepository(MenstrualRecordEntity)
    private readonly recordRepository: Repository<MenstrualRecordEntity>,
  ) {}

  async createCycle(
    user: UserEntity,
    request: CreateMenstrualCycleRequestDto,
  ): Promise<MenstrualCycleResponseDto> {
    this.assertValidDate(request.date);

    return this.cycleRepository.manager.transaction(async (manager) => {
      const recordRepository = manager.getRepository(MenstrualRecordEntity);
      await this.assertDateIsNotRecorded(
        recordRepository,
        user.id,
        request.date,
      );

      const cycleRepository = manager.getRepository(MenstrualCycleEntity);
      const cycle = await cycleRepository.save(
        cycleRepository.create({
          startDate: request.date,
          endDate: request.date,
          isEnd: false,
          user,
        }),
      );

      await recordRepository.save(
        recordRepository.create({
          date: request.date,
          menstruationStatus: '있음',
          flow: request.flow ?? null,
          symptoms: this.normalizeSymptoms(request.symptoms),
          cycle,
          user,
        }),
      );

      return new MenstrualCycleResponseDto(cycle);
    });
  }

  async createRecord(
    user: UserEntity,
    request: CreateMenstrualRecordRequestDto,
  ): Promise<MenstrualRecordResponseDto> {
    this.assertValidDate(request.date);

    return this.recordRepository.manager.transaction(async (manager) => {
      const cycle = await this.findOwnedCycle(
        manager,
        user.id,
        request.cycle_id,
      );
      this.assertDateBelongsToCycle(request.date, cycle);

      const recordRepository = manager.getRepository(MenstrualRecordEntity);
      await this.assertDateIsNotRecorded(
        recordRepository,
        user.id,
        request.date,
      );

      const record = recordRepository.create({
        date: request.date,
        menstruationStatus: request.menstruation_status,
        flow: this.flowForStatus(request.menstruation_status, request.flow),
        symptoms:
          request.menstruation_status === '있음'
            ? this.normalizeSymptoms(request.symptoms)
            : null,
        cycle,
        user,
      });

      await this.applyCycleStatus(manager, cycle, record);
      const savedRecord = await recordRepository.save(record);
      return new MenstrualRecordResponseDto(savedRecord);
    });
  }

  async getCycles(
    user: UserEntity,
    request: GetMenstrualCyclesRequestDto,
  ): Promise<MenstrualCyclesResponseDto> {
    this.assertValidDate(request.date);
    const cycles = await this.cycleRepository
      .createQueryBuilder('cycle')
      .where('cycle.userId = :userId', { userId: user.id })
      .andWhere('cycle.start_date <= :date', { date: request.date })
      .orderBy('cycle.start_date', 'DESC')
      .addOrderBy('cycle.id', 'DESC')
      .take(request.limit ?? 7)
      .getMany();

    return new MenstrualCyclesResponseDto(cycles);
  }

  async getRecord(
    user: UserEntity,
    date: string,
  ): Promise<MenstrualRecordResponseDto> {
    this.assertValidDate(date);
    const record = await this.recordRepository.findOne({
      where: { user: { id: user.id }, date },
    });
    return new MenstrualRecordResponseDto(record);
  }

  async updateRecord(
    user: UserEntity,
    request: MenstrualRecordFieldsDto,
  ): Promise<MenstrualRecordResponseDto> {
    this.assertValidDate(request.date);

    return this.recordRepository.manager.transaction(async (manager) => {
      const recordRepository = manager.getRepository(MenstrualRecordEntity);
      const record = await recordRepository.findOne({
        where: { user: { id: user.id }, date: request.date },
      });
      if (!record) {
        throw new NotFoundException('Menstrual record not found');
      }

      const previousStatus = record.menstruationStatus;
      record.menstruationStatus = request.menstruation_status;
      record.flow = this.flowForStatus(
        request.menstruation_status,
        request.flow,
      );
      record.symptoms =
        request.menstruation_status === '있음'
          ? this.normalizeSymptoms(request.symptoms)
          : null;

      if (previousStatus !== request.menstruation_status) {
        await this.applyCycleStatus(manager, record.cycle, record);
      }

      const savedRecord = await recordRepository.save(record);
      return new MenstrualRecordResponseDto(savedRecord);
    });
  }

  async deleteCycle(user: UserEntity, cycleId: number): Promise<void> {
    const cycle = await this.cycleRepository.findOne({
      where: { id: cycleId, user: { id: user.id } },
    });
    if (!cycle) {
      throw new NotFoundException('Menstrual cycle not found');
    }
    await this.cycleRepository.remove(cycle);
  }

  private async findOwnedCycle(
    manager: EntityManager,
    userId: number,
    cycleId: number,
  ): Promise<MenstrualCycleEntity> {
    const cycle = await manager.getRepository(MenstrualCycleEntity).findOne({
      where: { id: cycleId, user: { id: userId } },
    });
    if (!cycle) {
      throw new NotFoundException('Menstrual cycle not found');
    }
    return cycle;
  }

  private async applyCycleStatus(
    manager: EntityManager,
    cycle: MenstrualCycleEntity,
    record: Pick<MenstrualRecordEntity, 'date' | 'menstruationStatus'>,
  ): Promise<void> {
    const cycleRepository = manager.getRepository(MenstrualCycleEntity);

    if (record.menstruationStatus === '있음') {
      cycle.endDate = record.date;
      cycle.isEnd = false;
    } else {
      if (record.date <= cycle.startDate) {
        throw new BadRequestException(
          'The cycle end date must be after its start date',
        );
      }
      cycle.endDate = this.addDays(record.date, -1);
      cycle.isEnd = true;
      await manager.getRepository(MenstrualRecordEntity).delete({
        cycle: { id: cycle.id },
        date: MoreThan(record.date),
      });
    }

    await cycleRepository.save(cycle);
  }

  private assertDateBelongsToCycle(
    date: string,
    cycle: MenstrualCycleEntity,
  ): void {
    if (date < cycle.startDate) {
      throw new BadRequestException(
        'The record date cannot be before the cycle start date',
      );
    }
  }

  private async assertDateIsNotRecorded(
    repository: Repository<MenstrualRecordEntity>,
    userId: number,
    date: string,
  ): Promise<void> {
    const existing = await repository.findOne({
      where: { user: { id: userId }, date },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Menstrual record already exists');
    }
  }

  private flowForStatus(
    status: MenstrualRecordEntity['menstruationStatus'],
    flow?: MenstrualFlow | null,
  ): MenstrualFlow | null {
    return status === '있음' ? (flow ?? null) : null;
  }

  private normalizeSymptoms(symptoms?: string[] | null): string[] | null {
    if (!symptoms) {
      return null;
    }
    const normalized = [...new Set(symptoms.map((item) => item.trim()))].filter(
      Boolean,
    );
    return normalized.length > 0 ? normalized : null;
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
}
