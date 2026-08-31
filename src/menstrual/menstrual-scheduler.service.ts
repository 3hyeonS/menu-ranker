import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as cron from 'node-cron';
import { MenstrualService } from './menstrual.service';

@Injectable()
export class MenstrualSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MenstrualSchedulerService.name);
  private scheduledTask: { stop: () => void } | null = null;

  constructor(private readonly menstrualService: MenstrualService) {}

  onModuleInit(): void {
    this.runFinalization('startup');
    this.scheduledTask = cron.schedule(
      '0 0 * * *',
      () => this.runFinalization('midnight'),
      { timezone: 'Asia/Seoul' },
    );
  }

  onModuleDestroy(): void {
    this.scheduledTask?.stop();
  }

  private runFinalization(trigger: 'startup' | 'midnight'): void {
    const today = this.getTodayInSeoul();
    void this.menstrualService
      .finalizeDueCycles(today)
      .then((count) => {
        if (count > 0) {
          this.logger.log(
            `Finalized ${count} menstrual cycle(s) for ${today} (${trigger})`,
          );
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.stack : String(error);
        this.logger.error(
          `Failed to finalize menstrual cycles for ${today} (${trigger})`,
          message,
        );
      });
  }

  private getTodayInSeoul(): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  }
}
