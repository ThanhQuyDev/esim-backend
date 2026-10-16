import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiraloService } from './airalo/airalo.service';
import { EsimAccessService } from './esimaccess/esimaccess.service';
import { MicroEsimService } from './microesim/microesim.service';
import { BillionService } from './billion/billion.service';
import { PlansService } from '../plans/plans.service';
import { ProfitMarginsService } from '../profit-margins/profit-margins.service';

/** Where the full catalogue sync stands, for the CMS (doitac-1410 #074). */
export interface FullSyncStatus {
  running: boolean;
  trigger: 'cron' | 'manual' | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  /** Suppliers whose call failed in the last run, with the reason. */
  errors: string[];
}

@Injectable()
export class SyncOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(SyncOrchestratorService.name);

  private status: FullSyncStatus = {
    running: false,
    trigger: null,
    startedAt: null,
    finishedAt: null,
    errors: [],
  };

  constructor(
    private readonly airaloService: AiraloService,
    private readonly esimAccessService: EsimAccessService,
    private readonly microEsimService: MicroEsimService,
    private readonly billionService: BillionService,
    private readonly plansService: PlansService,
    private readonly profitMarginsService: ProfitMarginsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // await this.runFullSync();
  }

  getStatus(): FullSyncStatus {
    return { ...this.status, errors: [...this.status.errors] };
  }

  /**
   * "Cập nhật lại toàn bộ sản phẩm" (doitac-1410 #074): the 6-hourly sync,
   * now. It runs in the background — calling every supplier takes minutes —
   * and a run already under way is not started a second time.
   */
  startManualSync(): { started: boolean; status: FullSyncStatus } {
    if (this.status.running) {
      return { started: false, status: this.getStatus() };
    }
    void this.runFullSync('manual').catch((err: Error) =>
      this.logger.error(`Manual full sync failed: ${err.message}`),
    );
    return { started: true, status: this.getStatus() };
  }

  @Cron('0 */6 * * *')
  async runFullSync(trigger: 'cron' | 'manual' = 'cron'): Promise<void> {
    // One run at a time: a manual run must not overlap the scheduled one.
    if (this.status.running) {
      this.logger.warn(
        `Full sync (${trigger}) skipped: one is already running`,
      );
      return;
    }
    this.status = {
      running: true,
      trigger,
      startedAt: new Date(),
      finishedAt: null,
      errors: [],
    };
    try {
      await this.syncEverything();
    } finally {
      this.status = { ...this.status, running: false, finishedAt: new Date() };
    }
  }

  private async syncEverything(): Promise<void> {
    this.logger.log(
      'Starting full sync: Airalo → EsimAccess → Recalculate → Mark Cheapest',
    );

    try {
      await this.airaloService.syncPlans();
    } catch (error: any) {
      this.logger.error(`Airalo sync failed: ${error.message}`);
      this.status.errors.push(`Airalo: ${error.message}`);
    }

    try {
      await this.esimAccessService.syncPlans();
    } catch (error: any) {
      this.logger.error(`EsimAccess sync failed: ${error.message}`);
      this.status.errors.push(`eSIM Access: ${error.message}`);
    }

    try {
      await this.microEsimService.syncPlans();
    } catch (error: any) {
      this.logger.error(`MicroEsim sync failed: ${error.message}`);
      this.status.errors.push(`MicroEsim: ${error.message}`);
    }

    try {
      await this.billionService.syncPlans();
    } catch (error: any) {
      this.logger.error(`Billion sync failed: ${error.message}`);
      this.status.errors.push(`Billion: ${error.message}`);
    }

    this.logger.log('Recalculating prices by tiers...');
    await this.profitMarginsService.recalculateAllPlanPrices();

    this.logger.log('Updating VND prices...');
    await this.plansService.updateVndPrices();

    // After the VND prices: the de-duplication compares costs in đồng (#004).
    this.logger.log('Marking cheapest plans...');
    await this.plansService.markCheapestPlans();

    this.logger.log('Refreshing providers on destinations and regions...');
    await this.plansService.refreshProviders();

    this.logger.log('Full sync completed.');
  }
}
