import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiraloService } from './airalo/airalo.service';
import { EsimAccessService } from './esimaccess/esimaccess.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class SyncOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(SyncOrchestratorService.name);

  constructor(
    private readonly airaloService: AiraloService,
    private readonly esimAccessService: EsimAccessService,
    private readonly plansService: PlansService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runFullSync();
  }

  @Cron('0 */6 * * *')
  async runFullSync(): Promise<void> {
    this.logger.log('Starting full sync: Airalo → EsimAccess → Mark Cheapest');

    try {
      await this.airaloService.syncPlans();
    } catch (error) {
      this.logger.error(`Airalo sync failed: ${error.message}`);
    }

    try {
      await this.esimAccessService.syncPlans();
    } catch (error) {
      this.logger.error(`EsimAccess sync failed: ${error.message}`);
    }

    this.logger.log('Marking cheapest plans...');
    await this.plansService.markCheapestPlans();
    this.logger.log('Full sync completed.');
  }
}
