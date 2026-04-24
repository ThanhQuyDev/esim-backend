import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlanRepository } from './infrastructure/persistence/plan.repository';

@Injectable()
export class ExchangeRateCronService {
  private readonly logger = new Logger(ExchangeRateCronService.name);

  constructor(private readonly planRepository: PlanRepository) {}

  @Cron(CronExpression.EVERY_HOUR)
  async updateVndPrices(): Promise<void> {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) {
        this.logger.error(`Exchange rate API error: ${res.status}`);
        return;
      }
      const data = await res.json();
      const rate: number = data?.rates?.VND;
      if (!rate) {
        this.logger.error('VND rate not found in response');
        return;
      }
      await this.planRepository.updateAllVndPrices(rate);
      this.logger.log(`Updated vndPrice for all plans (1 USD = ${rate} VND)`);
    } catch (err) {
      this.logger.error('Failed to update vndPrice', err);
    }
  }
}
