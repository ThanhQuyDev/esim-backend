import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class CheapestMarkerService {
  private readonly logger = new Logger(CheapestMarkerService.name);

  constructor(private readonly plansService: PlansService) {}

  async onModuleInit(): Promise<void> {
    // await this.markCheapest();
  }
  @Cron('5 */6 * * *')
  async markCheapest(): Promise<void> {
    this.logger.log('Marking cheapest plans...');
    await this.plansService.markCheapestPlans();
    this.logger.log('Cheapest plans marked.');
  }
}
