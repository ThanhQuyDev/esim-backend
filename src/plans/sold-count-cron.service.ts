import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlansService } from './plans.service';

/**
 * Keeps "units sold" current on plans, destinations and regions (#053).
 *
 * Hourly is plenty for a figure shown as "Đã bán …"; the recount only writes
 * rows whose number changed.
 */
@Injectable()
export class SoldCountCronService {
  private readonly logger = new Logger(SoldCountCronService.name);

  constructor(private readonly plansService: PlansService) {}

  @Cron('20 * * * *')
  async recalculate(): Promise<void> {
    try {
      await this.plansService.recalculateSoldCounts();
      this.logger.log('Sold counts recalculated.');
    } catch (error) {
      // A failed recount must not take anything else down; the next run retries.
      this.logger.error(
        `Sold count recount failed: ${(error as Error).message}`,
      );
    }
  }
}
