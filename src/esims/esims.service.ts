import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateEsimDto } from './dto/create-esim.dto';
import { UpdateEsimDto } from './dto/update-esim.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterEsimDto, SortEsimDto } from './dto/query-esim.dto';
import { EsimRepository } from './infrastructure/persistence/esim.repository';
import { Esim } from './domain/esim';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { AiraloService } from '../esim-providers/airalo/airalo.service';
import { EsimAccessService } from '../esim-providers/esimaccess/esimaccess.service';
import {
  GadgetKoreaService,
  parseGadgetKoreaUsageMb,
  parseGadgetKoreaUtc,
} from '../esim-providers/gadgetkorea/gadgetkorea.service';
import { MicroEsimService } from '../esim-providers/microesim/microesim.service';
import { BillionService } from '../esim-providers/billion/billion.service';

export interface DataUsageResult {
  remaining: number | null;
  total: number;
  dataUsed: number;
  expiredAt: string | null;
  isUnlimited: boolean;
  status: string;
  lastUpdateTime: string | null;
  /**
   * When the eSIM first connected to a network. Null until it has been
   * activated — which is exactly what the profile page needs to say "chưa kích
   * hoạt" instead of showing a countdown that has not started (#062).
   */
  activatedAt?: string | null;
  /** Plan length in days, so the page can draw a time bar like the data bar. */
  durationDays?: number | null;
  /**
   * False when nothing real is known about consumption — the provider has no
   * usage API (Viettel and other local inventory) or the eSIM lacks the ids
   * needed to ask. The page then says so instead of drawing a full bar (#027).
   */
  usageAvailable?: boolean;
}

@Injectable()
export class EsimsService {
  private readonly logger = new Logger(EsimsService.name);

  constructor(
    private readonly esimsRepository: EsimRepository,
    private readonly airaloService: AiraloService,
    private readonly esimAccessService: EsimAccessService,
    private readonly gadgetKoreaService: GadgetKoreaService,
    @Inject(forwardRef(() => MicroEsimService))
    private readonly microEsimService: MicroEsimService,
    @Inject(forwardRef(() => BillionService))
    private readonly billionService: BillionService,
  ) {}

  /**
   * An eSIM attached to an order item was created BECAUSE a customer bought it,
   * so it must read as `sold` — never `available`.
   *
   * Only Viettel / local inventory is uploaded ahead of time and genuinely sits
   * `available` until someone buys it. Every API provider (esimaccess, airalo,
   * gadgetkorea, billion, microesim) provisions on purchase,
   * and each of those integrations passed `status: 'available'` — so the CMS
   * listed sold eSIMs as unsold stock. Applying the rule here instead of at the
   * dozen call sites means the next provider integration cannot get it wrong.
   *
   * `refunded` is never overwritten: a late provider callback must not
   * resurrect an eSIM that has already been refunded.
   */
  private resolveDeliveredStatus(
    status: string | null | undefined,
    orderItemId: number | null | undefined,
    currentStatus?: string | null,
  ): string | undefined {
    if (currentStatus === 'refunded') return undefined;
    if (status === undefined || status === null) return status ?? undefined;
    if (status === 'available' && orderItemId != null) return 'sold';
    return status;
  }

  async create(createEsimDto: CreateEsimDto): Promise<Esim> {
    const existingByIccid = await this.esimsRepository.findByIccid(
      createEsimDto.iccid,
    );
    if (existingByIccid) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { iccid: 'iccidAlreadyExists' },
      });
    }

    return this.esimsRepository.create({
      orderItemId: createEsimDto.orderItemId ?? null,
      userId: createEsimDto.userId ?? null,
      planId: createEsimDto.planId ?? null,
      iccid: createEsimDto.iccid,
      smdpAddress: createEsimDto.smdpAddress ?? null,
      activationCode: createEsimDto.activationCode ?? null,
      lpa: createEsimDto.lpa ?? null,
      matchId: createEsimDto.matchId ?? null,
      qrcode: createEsimDto.qrcode ?? null,
      qrAccessToken: crypto.randomUUID(),
      directAppleInstallationUrl:
        createEsimDto.directAppleInstallationUrl ?? null,
      apnValue: createEsimDto.apnValue ?? null,
      isRoaming: createEsimDto.isRoaming ?? null,
      status:
        this.resolveDeliveredStatus(
          createEsimDto.status ?? 'available',
          createEsimDto.orderItemId,
        ) ?? 'available',
      dataUsed: createEsimDto.dataUsed ?? null,
      dataTotal: createEsimDto.dataTotal ?? null,
      expiresAt: createEsimDto.expiresAt ?? null,
      activatedAt: createEsimDto.activatedAt ?? null,
      esimTranNo: createEsimDto.esimTranNo ?? null,
      provider: createEsimDto.provider ?? null,
      phoneNumber: createEsimDto.phoneNumber ?? null,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterEsimDto | null;
    sortOptions?: SortEsimDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Esim[], number]> {
    return this.esimsRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Esim['id']): Promise<NullableType<Esim>> {
    return this.esimsRepository.findById(id);
  }

  findByIdWithRelations(id: Esim['id']): Promise<NullableType<Esim>> {
    return this.esimsRepository.findByIdWithRelations(id);
  }

  findByIccid(iccid: Esim['iccid']): Promise<NullableType<Esim>> {
    return this.esimsRepository.findByIccid(iccid);
  }

  findByOrderItemIds(orderItemIds: number[]): Promise<Esim[]> {
    return this.esimsRepository.findByOrderItemIds(orderItemIds);
  }

  findAvailableByPlanId(planId: number, limit: number): Promise<Esim[]> {
    return this.esimsRepository.findAvailableByPlanId(planId, limit);
  }

  async update(
    id: Esim['id'],
    updateEsimDto: UpdateEsimDto,
  ): Promise<Esim | null> {
    if (updateEsimDto.iccid) {
      const existingByIccid = await this.esimsRepository.findByIccid(
        updateEsimDto.iccid,
      );
      if (existingByIccid && existingByIccid.id !== Number(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { iccid: 'iccidAlreadyExists' },
        });
      }
    }

    // Provider callbacks re-send `status: 'available'` when they refresh an
    // eSIM's QR data, which would knock an already-sold eSIM back to unsold.
    // Only look the row up when a status is actually being written.
    let status = updateEsimDto.status;
    if (status !== undefined) {
      const current = await this.esimsRepository.findById(id);
      status = this.resolveDeliveredStatus(
        status,
        updateEsimDto.orderItemId ?? current?.orderItemId,
        current?.status,
      );
    }

    return this.esimsRepository.update(id, {
      orderItemId: updateEsimDto.orderItemId,
      userId: updateEsimDto.userId,
      planId: updateEsimDto.planId,
      iccid: updateEsimDto.iccid,
      smdpAddress: updateEsimDto.smdpAddress,
      activationCode: updateEsimDto.activationCode,
      status,
      dataUsed: updateEsimDto.dataUsed,
      dataTotal: updateEsimDto.dataTotal,
      expiresAt: updateEsimDto.expiresAt,
      activatedAt: updateEsimDto.activatedAt,
      esimTranNo: updateEsimDto.esimTranNo,
      provider: updateEsimDto.provider,
      phoneNumber: updateEsimDto.phoneNumber,
    });
  }

  async remove(id: Esim['id']): Promise<void> {
    await this.esimsRepository.remove(id);
  }

  removeMany(ids: Esim['id'][]): Promise<number> {
    return this.esimsRepository.removeMany(ids);
  }

  /**
   * Bulk-mark every eSIM tied to the given order's items as `refunded`.
   * Returns the number of rows updated.
   */
  markRefundedByOrderId(orderId: number): Promise<number> {
    return this.esimsRepository.markRefundedByOrderId(orderId);
  }

  /**
   * Data usage plus the activation timeline the profile page needs (#062).
   *
   * Providers report data, but most report nothing about WHEN the eSIM started
   * — so the page had no way to show time remaining and always printed "—".
   * The activation moment and the expiry are filled in here from what the cron
   * has recorded, and derived from the plan length when the provider gives no
   * expiry of its own.
   */
  async getDataUsage(esim: Esim): Promise<DataUsageResult> {
    const usage = await this.fetchProviderUsage(esim);
    return this.withTimeline(esim, usage);
  }

  private async fetchProviderUsage(esim: Esim): Promise<DataUsageResult> {
    if (esim.provider === 'airalo') {
      try {
        const usage = await this.airaloService.getDataUsage(esim.iccid);
        const airaloTotal = Number(usage.total) || 0;
        const airaloRemaining = Number(usage.remaining);
        const result: DataUsageResult = {
          remaining:
            usage.is_unlimited || !Number.isFinite(airaloRemaining)
              ? null
              : Math.max(0, airaloRemaining),
          total: airaloTotal,
          // An unlimited plan reports no meaningful remaining figure; subtracting
          // it produced NaN or a negative "used" (#027).
          dataUsed:
            Number.isFinite(airaloRemaining) && airaloTotal > 0
              ? Math.max(0, airaloTotal - airaloRemaining)
              : 0,
          expiredAt: usage.expired_at,
          isUnlimited: usage.is_unlimited,
          status: usage.status,
          lastUpdateTime: null,
        };
        await this.persistUsageSnapshot(esim, result);
        return result;
      } catch {
        return this.fallbackFromDb(esim);
      }
    }

    if (esim.provider === 'esimaccess') {
      if (!esim.esimTranNo) {
        // Without the id the provider cannot be asked; show what we stored
        // rather than an error panel (#027).
        return this.fallbackFromDb(esim);
      }
      try {
        const usage = await this.esimAccessService.getDataUsage(
          esim.esimTranNo,
        );
        const bytesToMb = (bytes: number) =>
          Math.round((bytes / (1024 * 1024)) * 100) / 100;
        const result: DataUsageResult = {
          remaining: bytesToMb(usage.totalData - usage.dataUsage),
          total: bytesToMb(usage.totalData),
          dataUsed: bytesToMb(usage.dataUsage),
          expiredAt: null,
          isUnlimited: false,
          // eSIM Access's usage endpoint reports no status, and hardcoding
          // ACTIVE meant `persistUsageSnapshot` stamped an activation date the
          // first time we merely POLLED — starting the customer's countdown
          // before they had used the eSIM. Data actually consumed is the proof
          // it connected; an eSIM already marked active stays active.
          status:
            usage.dataUsage > 0 || esim.activatedAt ? 'ACTIVE' : 'NOT_ACTIVE',
          lastUpdateTime: usage.lastUpdateTime,
        };
        await this.persistUsageSnapshot(esim, result);
        return result;
      } catch {
        return this.fallbackFromDb(esim);
      }
    }

    if (esim.provider === 'gadgetkorea') {
      // For gadgetkorea, the topupId is stored as orderRequestId in order-item
      // We need to find the order-item associated with this esim
      const esimWithRelations =
        await this.esimsRepository.findByIdWithRelations(esim.id);
      // The webhook now also records the topupId on the eSIM itself, so an eSIM
      // whose order item link is missing can still be looked up (#028).
      const orderRequestId =
        (esimWithRelations as any)?.orderItem?.orderRequestId ??
        esim.esimTranNo ??
        null;
      if (!orderRequestId) {
        return this.fallbackFromDb(esim);
      }
      try {
        const usage =
          await this.gadgetKoreaService.getDataUsage(orderRequestId);
        const dataUsedMb = parseGadgetKoreaUsageMb(usage.usage);
        // Gadget Korea reports what has been USED but never the package size, so
        // `total: 0` left the customer's page with an empty bar and "0 GB" — the
        // plan is the only place that knows how big the package is (#065).
        const totalMb = Number(esimWithRelations?.plan?.dataMb ?? 0) || 0;
        const activeTime = parseGadgetKoreaUtc(usage.activeTime);
        const result: DataUsageResult = {
          remaining: totalMb > 0 ? Math.max(0, totalMb - dataUsedMb) : null,
          total: totalMb,
          dataUsed: dataUsedMb,
          expiredAt: parseGadgetKoreaUtc(usage.expireTime),
          isUnlimited: false,
          // `NOT_ACTIVE` is the wording every other provider uses, and what the
          // profile page knows how to translate.
          status: activeTime ? 'ACTIVE' : 'NOT_ACTIVE',
          // Gadget Korea is the one provider that reports the real activation
          // moment; keep it instead of guessing "now" on the first poll.
          activatedAt: activeTime,
          lastUpdateTime: null,
        };
        await this.persistUsageSnapshot(esim, result);
        return result;
      } catch {
        return this.fallbackFromDb(esim);
      }
    }

    if (esim.provider === 'microesim') {
      // MicroEsim needs both topup_id (order-item.orderRequestId) and
      // device_id (stored on esim.esimTranNo) to query device detail.
      const esimWithRelations =
        await this.esimsRepository.findByIdWithRelations(esim.id);
      const topupId =
        (esimWithRelations as any)?.orderItem?.orderRequestId ?? null;
      const deviceId = esim.esimTranNo;
      if (!topupId || !deviceId) {
        return this.fallbackFromDb(esim);
      }
      try {
        const detail = await this.microEsimService.getDeviceDetail(
          topupId,
          deviceId,
        );
        const dataUsedMb = parseFloat(detail.data_usage ?? '0') || 0;
        const result: DataUsageResult = {
          remaining: null,
          total: 0,
          dataUsed: dataUsedMb,
          expiredAt: detail.expire_time || null,
          isUnlimited: false,
          status: detail.status
            ? detail.status.toUpperCase()
            : detail.active_time
              ? 'ACTIVE'
              : 'INACTIVE',
          lastUpdateTime: null,
        };
        await this.persistUsageSnapshot(esim, result);
        return result;
      } catch {
        return this.fallbackFromDb(esim);
      }
    }

    if (esim.provider === 'billion') {
      // BILLION F046 needs the main orderId (order-item.orderRequestId) and the
      // iccid. Usage is reported per sub-order: usageInfoList[].usageAmt in KB,
      // total quota in totalTraffic KB ('-1' = unlimited).
      const esimWithRelations =
        await this.esimsRepository.findByIdWithRelations(esim.id);
      const orderId =
        (esimWithRelations as any)?.orderItem?.orderRequestId ?? null;
      const iccid = esim.iccid;
      if (!orderId || !iccid) {
        return this.fallbackFromDb(esim);
      }
      try {
        const detail = await this.billionService.getUsage(orderId, iccid);
        const sub = detail.subOrderList?.[0];
        const usedKb = (sub?.usageInfoList ?? []).reduce(
          (sum, u) => sum + (parseFloat(u.usageAmt ?? u.useageAmt ?? '0') || 0),
          0,
        );
        const totalKb = parseFloat(sub?.totalTraffic ?? '0');
        const isUnlimited = totalKb === -1;
        const totalMb =
          isUnlimited || !Number.isFinite(totalKb) ? 0 : totalKb / 1024;
        const dataUsedMb = usedKb / 1024;
        const planStatusMap: Record<string, string> = {
          '0': 'INACTIVE',
          '1': 'ACTIVE',
          '2': 'FINISHED',
          '3': 'CANCELLED',
        };
        const result: DataUsageResult = {
          remaining: isUnlimited ? null : Math.max(totalMb - dataUsedMb, 0),
          total: totalMb,
          dataUsed: dataUsedMb,
          expiredAt: sub?.planEndTime || null,
          isUnlimited,
          status: planStatusMap[sub?.planStatus ?? ''] ?? 'UNKNOWN',
          lastUpdateTime: null,
        };
        await this.persistUsageSnapshot(esim, result);
        return result;
      } catch {
        return this.fallbackFromDb(esim);
      }
    }

    // Viettel and other local inventory have no usage API at all. Answering 404
    // left the customer's tab reading "Không thể tải dữ liệu sử dụng" (#027).
    return this.fallbackFromDb(esim, false);
  }

  /**
   * What we last stored, for when the provider cannot be asked right now.
   *
   * `usageAvailable` defaults to whether a usage figure was ever recorded: an
   * eSIM the cron has polled before still has real numbers, one it never could
   * poll does not.
   */
  private fallbackFromDb(
    esim: Esim,
    usageAvailable: boolean = esim.dataUsed !== null &&
      esim.dataUsed !== undefined &&
      esim.dataUsed !== '',
  ): DataUsageResult {
    const total = esim.dataTotal ? parseFloat(esim.dataTotal) || 0 : 0;
    const dataUsed = esim.dataUsed ? parseFloat(esim.dataUsed) || 0 : 0;
    return {
      // Unknown, not zero, when the package size is unknown.
      remaining: total > 0 ? Math.max(0, total - dataUsed) : null,
      total,
      dataUsed,
      // The stored expiry is the last thing the cron learned from the provider;
      // returning null here threw it away and left the page with no dates at all.
      expiredAt: esim.expiresAt ? esim.expiresAt.toISOString() : null,
      isUnlimited: false,
      // The order status ("sold") is not a usage status; the page printed it raw.
      status: esim.activatedAt ? 'ACTIVE' : 'NOT_ACTIVE',
      lastUpdateTime: null,
      usageAvailable,
    };
  }

  /**
   * Fill in when the eSIM started and when it runs out (#062).
   *
   * Most providers report data but not time. What we do know is the moment the
   * eSIM first showed as in use — recorded by the usage cron — and how long the
   * plan lasts, and the plan's clock starts at that first connection. So an
   * expiry the provider does not give is derived from those two, and the page
   * can finally draw a time bar instead of printing "—".
   */
  private async withTimeline(
    esim: Esim,
    usage: DataUsageResult,
  ): Promise<DataUsageResult> {
    // Re-read: `persistUsageSnapshot` may have just stamped the activation, and
    // the plan (for its duration) is not on the object the caller passed in.
    const stored = await this.esimsRepository.findByIdWithRelations(esim.id);
    const activatedAt = stored?.activatedAt ?? esim.activatedAt ?? null;
    const durationDays = Number(stored?.plan?.durationDays ?? 0) || null;

    let expiredAt =
      usage.expiredAt ??
      (stored?.expiresAt ? stored.expiresAt.toISOString() : null);

    if (!expiredAt && activatedAt && durationDays) {
      const expiry = new Date(activatedAt);
      expiry.setDate(expiry.getDate() + durationDays);
      expiredAt = expiry.toISOString();
    }

    return {
      ...usage,
      expiredAt,
      activatedAt: activatedAt ? new Date(activatedAt).toISOString() : null,
      durationDays,
    };
  }

  /**
   * Providers that expose a usage/status API. Viettel and other local
   * inventory is uploaded from a spreadsheet and has nothing to poll.
   */
  private static readonly USAGE_REFRESH_PROVIDERS = [
    'airalo',
    'esimaccess',
    'gadgetkorea',
    'billion',
    'microesim',
  ];

  /** Cap per run so one sweep cannot hammer the provider APIs. */
  private static readonly USAGE_REFRESH_BATCH = 100;

  /**
   * Refresh data usage, activation time and expiry for live eSIMs.
   *
   * Until now these numbers were only fetched when somebody opened an eSIM,
   * so the order screen showed whatever was written at purchase time — usually
   * 0 used and no activation date. Polling on a schedule is what makes the
   * order detail actually reflect reality.
   *
   * Errors are swallowed per eSIM: one provider being down must not stop the
   * rest of the sweep.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async refreshActiveEsimUsage(): Promise<void> {
    const esims = await this.esimsRepository.findDueForUsageRefresh(
      EsimsService.USAGE_REFRESH_PROVIDERS,
      EsimsService.USAGE_REFRESH_BATCH,
    );

    if (!esims.length) return;

    let refreshed = 0;
    for (const esim of esims) {
      try {
        await this.getDataUsage(esim);
        refreshed++;
      } catch (error) {
        this.logger.warn(
          `Usage refresh failed for eSIM ${esim.id} (${esim.provider}): ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Usage refresh: ${refreshed}/${esims.length} eSIMs updated`,
    );
  }

  /**
   * Persist whatever the provider told us about the lifecycle of an eSIM.
   *
   * `getDataUsage` used to store only the data counters, so the activation and
   * expiry dates on the order screen stayed empty even after the provider
   * started reporting them.
   */
  private async persistUsageSnapshot(
    esim: Esim,
    result: DataUsageResult,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      dataUsed: String(result.dataUsed),
    };

    // Some providers do not report a package size; writing their 0 would wipe
    // the total we already know from the plan.
    if (result.total > 0) {
      patch.dataTotal = String(result.total);
    }

    if (result.expiredAt) {
      patch.expiresAt = new Date(result.expiredAt);
    }

    // A provider that reports the activation moment itself is always right;
    // otherwise the first poll that shows the eSIM in use is the best estimate
    // we have (#065).
    const reported = result.activatedAt ? new Date(result.activatedAt) : null;
    const isActive = (result.status ?? '').toUpperCase() === 'ACTIVE';
    if (reported && !Number.isNaN(reported.getTime())) {
      if (!esim.activatedAt) patch.activatedAt = reported;
    } else if (isActive && !esim.activatedAt) {
      patch.activatedAt = new Date();
    }

    await this.esimsRepository.update(esim.id, patch);
  }

  /**
   * Soft-delete sold/refunded eSIMs older than 6 months to free resources.
   * Runs daily at 2:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupSoldEsims(): Promise<void> {
    // ~6 months; the exact boundary of a retention sweep is immaterial.
    const SIX_MONTHS_IN_DAYS = 180;

    const deletedSold = await this.esimsRepository.softDeleteByStatusOlderThan(
      'sold',
      SIX_MONTHS_IN_DAYS,
    );

    const deletedRefunded =
      await this.esimsRepository.softDeleteByStatusOlderThan(
        'refunded',
        SIX_MONTHS_IN_DAYS,
      );

    const total = deletedSold + deletedRefunded;
    if (total > 0) {
      this.logger.log(
        `Cleaned up ${deletedSold} sold + ${deletedRefunded} refunded eSIMs older than 6 months`,
      );
    }
  }
}
