import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlansService } from './plans.service';

@Injectable()
export class ExchangeRateCronService {
  constructor(private readonly plansService: PlansService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async updateVndPrices(): Promise<void> {
    await this.plansService.updateVndPrices();
  }
}
