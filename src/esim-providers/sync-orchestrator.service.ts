import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiraloService } from './airalo/airalo.service';
import { EsimAccessService } from './esimaccess/esimaccess.service';
import { MicroEsimService } from './microesim/microesim.service';
import { BillionService } from './billion/billion.service';
import { PlansService } from '../plans/plans.service';
import { ProfitMarginsService } from '../profit-margins/profit-margins.service';
import { ProviderSalesStatusEntity } from '../providers/infrastructure/persistence/relational/entities/provider-sales-status.entity';
import { FullSyncRunEntity } from './entities/full-sync-run.entity';

/** Where the full catalogue sync stands, for the CMS (doitac-1410 #074). */
export interface FullSyncStatus {
  running: boolean;
  trigger: 'cron' | 'manual' | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  /** Suppliers whose call failed in the last run, with the reason. */
  errors: string[];
}

/** One past run for the CMS list (vande #078). */
export interface FullSyncRunView {
  id: number;
  startedAt: Date;
  finishedAt: Date | null;
  /** Whole seconds, null while the run is still going. */
  durationSeconds: number | null;
  /** "Hệ thống" for the scheduled run, else the admin's name or email. */
  startedBy: string;
  errors: string[];
}

/** Error recorded for a run the server restarted in the middle of. */
export const INTERRUPTED_RUN =
  'Bị dừng giữa chừng (máy chủ khởi động lại khi đang cập nhật)';

/** How many runs the history keeps and shows (vande #078). */
export const FULL_SYNC_HISTORY_SIZE = 5;

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
    @InjectRepository(ProviderSalesStatusEntity)
    private readonly salesStatus: Repository<ProviderSalesStatusEntity>,
    @InjectRepository(FullSyncRunEntity)
    private readonly runs: Repository<FullSyncRunEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    // await this.runFullSync();

    // A run the server was restarted in the middle of (a deploy, a crash)
    // would read "Đang chạy…" in the history for ever (vande #078).
    try {
      await this.runs.query(
        `UPDATE "full_sync_run"
            SET "finishedAt" = now(), "errors" = $1::jsonb
          WHERE "finishedAt" IS NULL`,
        [JSON.stringify([INTERRUPTED_RUN])],
      );
    } catch (err) {
      this.logger.warn(
        `Could not close interrupted sync runs: ${(err as Error).message}`,
      );
    }
  }

  getStatus(): FullSyncStatus {
    return { ...this.status, errors: [...this.status.errors] };
  }

  /**
   * "Cập nhật lại toàn bộ sản phẩm" (doitac-1410 #074): the 6-hourly sync,
   * now. It runs in the background — calling every supplier takes minutes —
   * and a run already under way is not started a second time.
   */
  startManualSync(adminId?: number | null): {
    started: boolean;
    status: FullSyncStatus;
  } {
    if (this.status.running) {
      return { started: false, status: this.getStatus() };
    }
    void this.runFullSync('manual', adminId ?? null).catch((err: Error) =>
      this.logger.error(`Manual full sync failed: ${err.message}`),
    );
    return { started: true, status: this.getStatus() };
  }

  @Cron('0 */6 * * *')
  async runFullSync(
    trigger: 'cron' | 'manual' = 'cron',
    adminId: number | null = null,
  ): Promise<void> {
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
    const run = await this.recordStart(trigger, adminId);
    try {
      await this.syncEverything();
    } finally {
      this.status = { ...this.status, running: false, finishedAt: new Date() };
      await this.recordFinish(run);
    }
  }

  /** The latest runs, newest first, with who started them (vande #078). */
  async getHistory(): Promise<FullSyncRunView[]> {
    const rows: (FullSyncRunEntity & {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
    })[] = await this.runs.query(
      `SELECT r.*, u."firstName", u."lastName", u."email"
         FROM "full_sync_run" r
         LEFT JOIN "user" u ON u.id = r."adminId"
        ORDER BY r."startedAt" DESC, r.id DESC
        LIMIT $1`,
      [FULL_SYNC_HISTORY_SIZE],
    );
    return rows.map((row) => {
      const name = [row.firstName, row.lastName].filter(Boolean).join(' ');
      const startedAt = new Date(row.startedAt);
      const finishedAt = row.finishedAt ? new Date(row.finishedAt) : null;
      return {
        id: Number(row.id),
        startedAt,
        finishedAt,
        durationSeconds: finishedAt
          ? Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)
          : null,
        startedBy:
          row.trigger === 'cron'
            ? 'Hệ thống'
            : name ||
              row.email ||
              (row.adminId ? `Admin #${row.adminId}` : 'Admin'),
        errors: row.errors ?? [],
      };
    });
  }

  /** A history row for this run; a failed write never stops the sync. */
  private async recordStart(
    trigger: 'cron' | 'manual',
    adminId: number | null,
  ): Promise<FullSyncRunEntity | null> {
    try {
      return await this.runs.save(
        this.runs.create({
          trigger,
          adminId,
          startedAt: this.status.startedAt ?? new Date(),
          finishedAt: null,
          errors: [],
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Could not record the sync start: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Close the run's row and keep only the latest runs. */
  private async recordFinish(run: FullSyncRunEntity | null): Promise<void> {
    if (!run) return;
    try {
      await this.runs.update(run.id, {
        finishedAt: this.status.finishedAt ?? new Date(),
        errors: this.status.errors,
      });
      await this.runs.query(
        `DELETE FROM "full_sync_run" WHERE id NOT IN (
           SELECT id FROM "full_sync_run" ORDER BY "startedAt" DESC, id DESC LIMIT $1
         )`,
        [FULL_SYNC_HISTORY_SIZE],
      );
    } catch (err) {
      this.logger.warn(
        `Could not record the sync end: ${(err as Error).message}`,
      );
    }
  }

  private async syncEverything(): Promise<void> {
    this.logger.log(
      'Starting full sync: Airalo → EsimAccess → Recalculate → Mark Cheapest',
    );

    // A supplier switched off in "Ngưng bán" (#005) is not synced: its
    // plans would come back on sale, since the switch only takes off the plans
    // that existed when it was flipped.
    const disabled = new Set(
      (await this.salesStatus.find({ where: { isEnabled: false } })).map(
        (row) => row.provider,
      ),
    );
    const suppliers: [string, string, () => Promise<unknown>][] = [
      ['airalo', 'Airalo', () => this.airaloService.syncPlans()],
      ['esimaccess', 'eSIM Access', () => this.esimAccessService.syncPlans()],
      ['microesim', 'MicroEsim', () => this.microEsimService.syncPlans()],
      ['billion', 'Billion', () => this.billionService.syncPlans()],
    ];
    for (const [slug, label, sync] of suppliers) {
      if (disabled.has(slug)) {
        this.logger.log(`${label} sync skipped: supplier is switched off`);
        continue;
      }
      try {
        await sync();
      } catch (error: any) {
        this.logger.error(`${label} sync failed: ${error.message}`);
        this.status.errors.push(`${label}: ${error.message}`);
      }
    }

    // Whatever the last supplier left half a batch of (vande #078).
    await this.plansService.flushSyncedPlans();

    this.logger.log('Recalculating prices by tiers...');
    await this.profitMarginsService.recalculateAllPlanPrices();

    this.logger.log('Updating VND prices...');
    await this.plansService.updateVndPrices();

    // After the VND prices: the de-duplication compares costs in đồng (#004).
    this.logger.log('Marking cheapest plans...');
    await this.plansService.markCheapestPlans();

    this.logger.log('Refreshing providers on destinations and regions...');
    await this.plansService.refreshProviders();

    // Standard names follow data, days and location names (vande #020).
    this.logger.log('Refreshing standard plan names...');
    await this.plansService.refreshStandardNames();

    this.logger.log('Full sync completed.');
  }
}
