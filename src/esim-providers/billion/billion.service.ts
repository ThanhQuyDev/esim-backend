import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { AllConfigType } from '../../config/config.type';
import { PlansService } from '../../plans/plans.service';
import { DestinationsService } from '../../destinations/destinations.service';
import { RegionsService } from '../../regions/regions.service';
import { ProviderSyncLogsService } from '../../provider-sync-logs/provider-sync-logs.service';
import { OrderItemsService } from '../../order-items/order-items.service';
import { EsimsService } from '../../esims/esims.service';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../../users/users.service';
import { OrdersService } from '../../orders/orders.service';
import {
  BillionApiResponse,
  BillionCreateOrderResult,
  BillionPrice,
  BillionProduct,
  BillionProfileStatus,
  BillionQrNotification,
  BillionUsageResult,
} from './billion-api.types';

const PROVIDER = 'billion';

/**
 * BILLION product `type` codes that represent an eSIM (the only kinds we sync).
 * 230 = eSIM, 3105 = eSIM + self-selected plan, 3106 = eSIM + fixed plan.
 */
const ESIM_TYPES = new Set(['230', '3105', '3106']);

/**
 * BILLION's F003 price fields (`retailPrice` / `settlementPrice`) carry NO
 * currency in the API docs. We assume USD and use the settlement price directly
 * as the cost. If the partner confirms the prices are actually RMB, set this to
 * false — {@link BillionService.upsertPlan} will then convert via
 * {@link RMB_TO_USD}, mirroring the HKD→USD handling in MicroEsimService.
 */
const BILLION_PRICE_IS_USD = true;

/** Fallback RMB→USD rate, applied only when BILLION_PRICE_IS_USD is false. */
const RMB_TO_USD = 0.14;

/**
 * BILLION recharge (topup) tradeType. Per API docs §3.7 "创建充值订单 / Create
 * recharge order" — F007 adds a data plan to one or more existing eSIM ICCIDs.
 * Confirmed against the official spec PDF (2026-08): request keys on an
 * `iccid[]` + `skuId`, not on the original F040 orderId.
 */
const BILLION_TOPUP_TRADE_TYPE = 'F007';

/**
 * BILLION query-recharge-commodities tradeType. Per API docs §3.28
 * "查询eSIM充值商品 / Query eSIM recharge commodities" — F052 returns the skuIds
 * that a given ICCID is eligible to recharge with.
 */
const BILLION_RECHARGE_COMMODITIES_TRADE_TYPE = 'F052';

@Injectable()
export class BillionService {
  private readonly logger = new Logger(BillionService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly plansService: PlansService,
    private readonly destinationsService: DestinationsService,
    private readonly regionsService: RegionsService,
    private readonly providerSyncLogsService: ProviderSyncLogsService,
    private readonly orderItemsService: OrderItemsService,
    @Inject(forwardRef(() => EsimsService))
    private readonly esimsService: EsimsService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  // ─── Auth / transport ──────────────────────────────────────────────────────

  private get channelId(): string {
    return this.configService.getOrThrow('billion.channelId', { infer: true });
  }

  private get appSecret(): string {
    return this.configService.getOrThrow('billion.appSecret', { infer: true });
  }

  private get baseUrl(): string {
    return this.configService.getOrThrow('billion.baseUrl', { infer: true });
  }

  /**
   * Communication timestamp in the format BILLION expects: `YYYY-MM-DD hh:mm:ss`
   * in UTC+8 (docs §2.1.2 — time is standardised to UTC/GMT+08:00).
   */
  private tradeTime(): string {
    const utc8 = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return utc8.toISOString().replace('T', ' ').slice(0, 19);
  }

  /**
   * Single-endpoint call. Builds the `{ tradeType, tradeTime, tradeData }`
   * envelope, signs it, POSTs it, and returns `tradeData`.
   *
   * Signature (docs §2.1.1): `x-sign-value = md5(appSecret + <exact json body>)`.
   * The body string must be signed and sent verbatim — we serialise once and
   * reuse the same string for both, so a re-serialisation can't change the sign.
   *
   * Throws when `tradeCode !== '1000'`.
   */
  private async invoke<T>(tradeType: string, tradeData: unknown): Promise<T> {
    const bodyString = JSON.stringify({
      tradeType,
      tradeTime: this.tradeTime(),
      tradeData,
    });

    const signValue = crypto
      .createHash('md5')
      .update(this.appSecret + bodyString)
      .digest('hex');

    const { data } = await firstValueFrom(
      this.httpService.post<BillionApiResponse<T>>(this.baseUrl, bodyString, {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'x-channel-id': this.channelId,
          'x-sign-method': 'md5',
          'x-sign-value': signValue,
        },
      }),
    );

    if (data.tradeCode !== '1000') {
      throw new Error(
        `BILLION ${tradeType} error: ${data.tradeCode} - ${data.tradeMsg}`,
      );
    }
    return data.tradeData as T;
  }

  // ─── Catalogue sync ──────────────────────────────────────────────────────

  async syncPlans(): Promise<void> {
    this.logger.log('Starting billion plan sync...');
    const syncStartedAt = new Date();

    const syncLog = await this.providerSyncLogsService.create({
      provider: PROVIDER,
      syncType: 'plans',
      status: 'started',
      startedAt: new Date(),
    });

    try {
      // F002 has products but no prices; F003 has prices keyed by skuId. Fetch
      // both and merge — a product without a price row is skipped.
      const [products, prices] = await Promise.all([
        this.invoke<BillionProduct[]>('F002', {
          salesMethod: '1',
          language: '2',
        }),
        this.invoke<BillionPrice[]>('F003', { salesMethod: '1' }),
      ]);

      const priceBySku = new Map<string, BillionPrice>();
      for (const p of prices ?? []) priceBySku.set(p.skuId, p);

      const esimProducts = (products ?? []).filter((p) =>
        ESIM_TYPES.has(p.type),
      );

      let itemsSynced = 0;
      for (const product of esimProducts) {
        try {
          const price = priceBySku.get(product.skuId);
          const cost = this.baseCost(price);
          if (cost == null) {
            this.logger.warn(
              `Skipping billion sku ${product.skuId} (${product.name}): no price`,
            );
            continue;
          }
          await this.processPlan(product, cost);
          itemsSynced++;
        } catch (error: any) {
          this.logger.error(
            `Failed to process billion plan ${product.skuId} (${product.name}): ${error.message}`,
            error.stack,
          );
          await this.providerSyncLogsService.update(syncLog.id, {
            status: 'failed',
            itemsSynced,
            errorMessage: `Plan ${product.skuId}: ${error.message}`,
            completedAt: new Date(),
          });
          throw error;
        }
      }

      await this.providerSyncLogsService.update(syncLog.id, {
        status: 'completed',
        itemsSynced,
        completedAt: new Date(),
      });

      await this.plansService.deactivateStaleProviderPlans(
        PROVIDER,
        syncStartedAt,
      );

      this.logger.log(
        `Billion plan sync completed. ${itemsSynced}/${esimProducts.length} eSIM plans synced.`,
      );
    } catch (error: any) {
      await this.providerSyncLogsService.update(syncLog.id, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      });
      this.logger.error(`Billion plan sync failed: ${error.message}`);
    }
  }

  /** Base cost = settlement price for the single-copy (`copies === '1'`) row. */
  private baseCost(price: BillionPrice | undefined): number | null {
    if (!price?.price?.length) return null;
    const single =
      price.price.find((row) => row.copies === '1') ?? price.price[0];
    const value = parseFloat(single.settlementPrice);
    return Number.isFinite(value) ? value : null;
  }

  private async processPlan(
    product: BillionProduct,
    cost: number,
  ): Promise<void> {
    const codes = (product.country ?? [])
      .map((c) => (c.mcc ?? '').trim())
      .filter(Boolean);
    const isRegion = codes.length > 1;

    if (isRegion) {
      const region = await this.resolveRegion(product, codes);
      await this.upsertPlan(product, null, region.id, cost);
    } else {
      const destination = await this.resolveDestinationByCode(codes[0] || '');
      await this.upsertPlan(product, destination.id, null, cost);
    }
  }

  private async resolveDestinationByCode(code: string) {
    const existing = await this.destinationsService.findByCountryCode(code);
    if (existing) return existing;

    const displayName = code;
    const byName = await this.destinationsService.findByName(displayName);
    if (byName) return byName;

    const slug = this.toSlug(displayName);
    try {
      return await this.destinationsService.create({
        name: displayName,
        slug,
        countryCode: code,
        isActive: true,
      });
    } catch {
      const bySlug = await this.destinationsService.findBySlug(slug);
      if (bySlug) return bySlug;
      throw new Error(`Failed to resolve destination for code ${code}`);
    }
  }

  private async resolveRegion(product: BillionProduct, codes: string[]) {
    // Stable identity key so the CMS can rename without detaching plans.
    const externalCode = `billion-${codes
      .map((c) => c.toLowerCase())
      .join('-')}`;
    const existing = await this.regionsService.findByExternalCode(externalCode);

    let region: { id: number };
    if (existing) {
      region = existing;
    } else {
      try {
        region = await this.regionsService.create({
          name: product.name,
          slug: externalCode,
          externalCode,
          isActive: true,
        });
      } catch {
        const retry =
          await this.regionsService.findByExternalCode(externalCode);
        if (retry) {
          region = retry;
        } else {
          throw new Error(`Failed to create or find region ${externalCode}`);
        }
      }
    }

    for (const code of codes) {
      const dest = await this.resolveDestinationByCode(code);
      await this.destinationsService.addRegion(dest.id, region.id);
    }

    return region;
  }

  private async upsertPlan(
    product: BillionProduct,
    destinationId: number | null,
    regionId: number | null,
    cost: number,
  ) {
    const { type, dataMb } = this.parseDataAndType(product);
    const days = parseInt(product.days ?? '0', 10) || 0;

    const codes = (product.country ?? [])
      .map((c) => (c.mcc ?? '').trim())
      .filter(Boolean);
    const locationCode = codes[0] || product.skuId;
    const slug = this.buildPlanSlug(
      regionId ? codes.join('-') : locationCode,
      dataMb,
      days,
      type,
    );

    const existing = await this.plansService.findBySlug(slug);

    // Cost currency is unknown per docs; assumed USD (see BILLION_PRICE_IS_USD).
    const costPrice = BILLION_PRICE_IS_USD ? cost : cost * RMB_TO_USD;

    const apn = product.apn || product.country?.[0]?.apn || null;
    const operator = product.country
      ?.map((c) => c.operator)
      .filter(Boolean)
      .join(',');

    const planData = {
      provider: PROVIDER,
      providerPlanId: product.skuId,
      name: product.name,
      countryCode: destinationId ? locationCode : null,
      destinationId,
      regionId,
      durationDays: days,
      dataMb,
      costPrice,
      price: costPrice,
      retailPrice: costPrice,
      currency: 'USD',
      sms: null,
      call: null,
      type,
      topUp: false,
      speed: null,
      operatorName: operator || null,
      fupSpeed: null,
      isAbleMultidate: false,
      isKyc: false,
      apn,
      hotSpot: product.hotspotSupport === '1',
      hotSpotAllow: this.formatHotSpotAllow(type, dataMb),
      lastSyncedAt: new Date(),
      isActive: true,
    };

    if (existing) {
      return this.plansService.update(existing.id, planData);
    }
    return this.plansService.create({ ...planData, slug });
  }

  /**
   * Derive the plan `type` and `dataMb`. BILLION expresses the high-speed daily
   * allowance in `highFlowSize` (KB/day) and total quota in `capacity` (KB); a
   * throttled peak (`limitFlowSpeed`) with no fixed total signals an unlimited
   * (reduce-after) plan. Falls back to parsing the product name.
   */
  private parseDataAndType(product: BillionProduct): {
    type: string;
    dataMb: number;
  } {
    const capacityKb = parseFloat(product.capacity ?? '') || 0;
    const highFlowKb = parseFloat(product.highFlowSize ?? '') || 0;
    const hasThrottle = (parseFloat(product.limitFlowSpeed ?? '') || 0) > 0;

    // Fixed total quota present → fixed plan.
    if (capacityKb > 0) {
      return { type: 'fixed', dataMb: Math.round(capacityKb / 1024) };
    }

    // Daily high-speed allowance + throttle after → unlimited (reduced speed).
    if (highFlowKb > 0 && hasThrottle) {
      return { type: 'unlimited-reduce', dataMb: 0 };
    }

    // Daily high-speed allowance, no explicit total → treat as fixed daily.
    if (highFlowKb > 0) {
      return { type: 'fixed', dataMb: Math.round(highFlowKb / 1024) };
    }

    // Last resort: parse the name (e.g. '...-1GB', '...-500MB').
    const dataMb = this.parseDataMb(product.name);
    if (dataMb > 0) return { type: 'fixed', dataMb };

    return hasThrottle
      ? { type: 'unlimited-reduce', dataMb: 0 }
      : { type: 'unlimited', dataMb: 0 };
  }

  /** Parse a data allowance like '1GB', '500MB' → MB. */
  private parseDataMb(text: string | undefined): number {
    if (!text) return 0;
    const match = text.match(/([\d.]+)\s*(gb|mb)/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    return match[2].toLowerCase() === 'gb'
      ? Math.round(value * 1024)
      : Math.round(value);
  }

  private formatHotSpotAllow(type: string, dataMb: number): string | null {
    if (type === 'unlimited' || type === 'unlimited-reduce') return null;
    if (!dataMb || dataMb <= 0) return null;
    if (dataMb < 1024) return `${dataMb}MB`;
    const gb = dataMb / 1024;
    if (Number.isInteger(gb)) return `${gb}GB`;
    return `${Math.round(gb * 10) / 10}GB`;
  }

  private buildPlanSlug(
    locationCode: string,
    dataMb: number,
    days: number,
    type: string,
  ): string {
    const code = locationCode.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const dataLabel =
      dataMb > 0
        ? `-${dataMb >= 1024 ? `${dataMb / 1024}gb` : `${dataMb}mb`}`
        : '';
    return `${code}${dataLabel}-${days}days-${type}-bl`;
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // ─── Orders / provisioning ───────────────────────────────────────────────

  /**
   * Create an eSIM order (F040). Returns the BILLION main `orderId`, which the
   * caller stores as the order-item `orderRequestId` for later lookup /
   * cancellation and to match incoming N009 webhooks.
   */
  async submitOrder(params: {
    channelOrderId: string;
    email: string;
    totalAmount?: number;
    subOrderList: Array<{
      channelSubOrderId: string;
      deviceSkuId: string;
      planSkuCopies?: number;
      number: number;
    }>;
  }): Promise<BillionCreateOrderResult> {
    this.logger.log(
      `Submitting BILLION order: channelOrderId=${params.channelOrderId}, items=${params.subOrderList.length}`,
    );

    const result = await this.invoke<BillionCreateOrderResult>('F040', {
      channelOrderId: params.channelOrderId,
      email: params.email,
      totalAmount:
        params.totalAmount != null ? String(params.totalAmount) : undefined,
      orderCreateTime: this.tradeTime(),
      subOrderList: params.subOrderList.map((s) => ({
        channelSubOrderId: s.channelSubOrderId,
        deviceSkuId: s.deviceSkuId,
        planSkuCopies: String(s.planSkuCopies ?? 1),
        number: String(s.number),
      })),
    });

    this.logger.log(`BILLION order created: orderId=${result.orderId}`);
    return result;
  }

  /** Query ESIM profile status (F042) for one iccid. */
  async getProfileStatus(iccid: string): Promise<BillionProfileStatus[]> {
    return this.invoke<BillionProfileStatus[]>('F042', { iccid });
  }

  /** Query data-plan usage (F046) by orderId (+ iccid required by the API). */
  async getUsage(orderId: string, iccid: string): Promise<BillionUsageResult> {
    return this.invoke<BillionUsageResult>('F046', {
      orderId,
      iccid,
      language: '2',
    });
  }

  /**
   * Cancel an order (F008). Best-effort — logs and swallows errors so the
   * cancellation flow is never blocked by a provider-side failure.
   */
  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.invoke('F008', { orderId });
      this.logger.log(`BILLION order cancelled: orderId=${orderId}`);
    } catch (err) {
      this.logger.error(
        `BILLION cancel failed (orderId=${orderId}): ${(err as Error).message}`,
      );
    }
  }

  // ─── Topup / recharge an existing eSIM ─────────────────────────────────────

  /**
   * List the recharge products (skuIds) an existing eSIM is eligible for
   * (F052 — Query eSIM recharge commodities, docs §3.28). Returns the raw
   * skuId list; the caller matches these against our `plan` catalogue.
   */
  async listRechargeSkuIds(iccid: string): Promise<string[]> {
    const result = await this.invoke<
      { skuId: string[] }[] | { skuId: string[] }
    >(BILLION_RECHARGE_COMMODITIES_TRADE_TYPE, { iccid });

    // Docs show two response shapes for tradeData: an object `{ skuId: [...] }`
    // and an array `[{ skuId: [...] }]`. Normalise both to a flat string[].
    if (Array.isArray(result)) {
      return result.flatMap((r) => r?.skuId ?? []);
    }
    return result?.skuId ?? [];
  }

  /**
   * Recharge an existing BILLION eSIM with a new data plan (topup).
   *
   * Uses F007 (创建充值订单 / Create recharge order, docs §3.7). A recharge is
   * keyed directly on the ICCID(s) being topped up plus the plan `skuId` — it
   * does NOT reference the original F040 order. Goes through the same signed
   * `invoke()` envelope as every other operation.
   *
   * @param params.channelOrderId  Our unique main-order reference for this recharge.
   * @param params.channelSubOrderId  Our unique sub-order reference.
   * @param params.iccid    ICCID of the SIM to recharge.
   * @param params.skuId    providerPlanId (skuId) of the topup plan.
   * @param params.copies   Number of plan copies (defaults to 1).
   * @param params.totalAmount  Optional order total (informational).
   */
  async submitTopup(params: {
    channelOrderId: string;
    channelSubOrderId: string;
    iccid: string;
    skuId: string;
    copies?: number;
    totalAmount?: number;
  }): Promise<BillionCreateOrderResult> {
    this.logger.log(
      `Submitting BILLION topup (F007): channelOrderId=${params.channelOrderId}, iccid=${params.iccid}, skuId=${params.skuId}`,
    );

    const result = await this.invoke<BillionCreateOrderResult>(
      BILLION_TOPUP_TRADE_TYPE,
      {
        channelOrderId: params.channelOrderId,
        totalAmount:
          params.totalAmount != null ? String(params.totalAmount) : undefined,
        orderCreateTime: this.tradeTime(),
        subOrderList: [
          {
            channelSubOrderId: params.channelSubOrderId,
            iccid: [params.iccid],
            skuId: params.skuId,
            copies: String(params.copies ?? 1),
          },
        ],
      },
    );

    this.logger.log(`BILLION topup submitted: orderId=${result.orderId}`);
    return result;
  }

  // ─── Provisioning (async webhook N009 + status poll fallback) ──────────────

  /**
   * Log a reminder that we're awaiting N009 webhooks for these orderIds.
   *
   * NOTE: unlike MicroEsim, BILLION exposes no query that returns the eSIM
   * QR/LPA — F042 only returns profile status and F046 only usage, and both
   * require an iccid we don't have until N009 arrives (docs FAQ §8–9). So the
   * eSIM can only be provisioned from the N009 webhook. BILLION retries N009 up
   * to 3 times; if all fail the eSIM must be retrieved from their sales
   * platform manually. This method only records the wait.
   */
  scheduleCallbackAfterSubmit(orderIds: string[]): void {
    const ids = orderIds.filter(Boolean);
    if (ids.length === 0) return;
    this.logger.log(
      `[Billion] Awaiting N009 QR webhook for orderId(s): ${ids.join(', ')}`,
    );
  }

  /**
   * Cron visibility: surface BILLION order items still pending an N009 webhook
   * so a lost notification is noticeable in logs. We cannot self-provision (see
   * scheduleCallbackAfterSubmit), so this only warns.
   */
  @Cron('0 */5 * * * *')
  async pollPendingCallbacks(): Promise<void> {
    try {
      const pendingItems =
        await this.orderItemsService.findPendingByProvider(PROVIDER);
      const orderIds = [
        ...new Set(
          pendingItems
            .map((item) => item.orderRequestId)
            .filter((id): id is string => id != null),
        ),
      ];
      if (orderIds.length === 0) return;
      this.logger.warn(
        `[Billion Poll] ${orderIds.length} order(s) still awaiting N009 QR webhook: ${orderIds.join(', ')}`,
      );
    } catch (err) {
      this.logger.error(
        `[Billion Poll] pollPendingCallbacks failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Handle an N009 (ESIM QR Code) webhook. Provisions every eSIM in the
   * notification. Idempotent on iccid — safe to run on BILLION's retries.
   */
  async handleCallback(payload: BillionQrNotification): Promise<void> {
    const orderId = payload?.orderId;
    const subOrders = payload?.subOrderList ?? [];
    if (!orderId || subOrders.length === 0) {
      this.logger.warn('[Billion] N009 callback missing orderId/subOrderList');
      return;
    }

    const orderItems =
      await this.orderItemsService.findByOrderRequestId(orderId);
    if (orderItems.length === 0) {
      this.logger.warn(`[Billion] No order item found for orderId=${orderId}`);
      return;
    }

    // All order items sharing a BILLION orderId belong to the same order.
    const orderItem = orderItems[0];
    const order = await this.ordersService.findById(orderItem.orderId);
    const userId = order?.userId ?? null;
    const plan = await this.plansService.findById(orderItem.planId);

    let anyCreated = false;
    for (const sub of subOrders) {
      if (!sub.iccid) continue;

      const lpa = sub.qrCodeContent ?? null;
      const smdpAddress = lpa ? this.extractSmdpFromLpa(lpa) : null;
      const activationCode = lpa
        ? this.extractActivationCodeFromLpa(lpa)
        : null;
      const apn = sub.apn ?? plan?.apn ?? null;

      let dataTotal: string | null = null;
      if (plan?.dataMb != null && plan.dataMb > 0) {
        dataTotal =
          plan.dataMb >= 1024 ? `${plan.dataMb / 1024}GB` : `${plan.dataMb}MB`;
      }

      const existing = await this.esimsService.findByIccid(sub.iccid);
      if (existing) {
        await this.esimsService.update(existing.id, {
          smdpAddress: smdpAddress ?? existing.smdpAddress ?? undefined,
          activationCode:
            activationCode ?? existing.activationCode ?? undefined,
          lpa: lpa ?? existing.lpa ?? undefined,
          apnValue: apn ?? existing.apnValue ?? undefined,
          phoneNumber: sub.msisdn ?? existing.phoneNumber ?? undefined,
          status: 'available',
          userId: userId ?? existing.userId ?? undefined,
          orderItemId: orderItem.id,
          planId: orderItem.planId,
          esimTranNo: sub.iccid,
          provider: PROVIDER,
          dataTotal: dataTotal ?? existing.dataTotal ?? undefined,
        });
        continue;
      }

      await this.esimsService.create({
        iccid: sub.iccid,
        smdpAddress,
        activationCode,
        lpa,
        qrcode: null,
        apnValue: apn,
        phoneNumber: sub.msisdn ?? null,
        status: 'available',
        userId,
        orderItemId: orderItem.id,
        planId: orderItem.planId,
        esimTranNo: sub.iccid,
        provider: PROVIDER,
        dataUsed: '0',
        dataTotal,
      });
      anyCreated = true;
      this.logger.log(
        `[Billion] eSIM created: iccid=${sub.iccid}, orderId=${orderId}`,
      );
    }

    for (const item of orderItems) {
      await this.orderItemsService.update(item.id, {
        status: 'completed',
        providerOrderId: orderId,
        providerOrderCode: orderId,
      });
    }

    if (anyCreated) {
      await this.sendPurchaseEmails(
        userId,
        orderItems.map((i) => i.id),
        orderId,
      );
    }
  }

  /** Send the eSIM purchase email for the given order items. Best-effort. */
  private async sendPurchaseEmails(
    userId: number | null,
    orderItemIds: number[],
    orderId: string,
  ): Promise<void> {
    if (!userId || orderItemIds.length === 0) return;
    try {
      const user = await this.usersService.findById(userId);
      if (!user?.email) return;

      for (const orderItemId of orderItemIds) {
        const esims = await this.esimsService.findByOrderItemIds([orderItemId]);
        for (const esim of esims) {
          const plan = esim.planId
            ? await this.plansService.findById(esim.planId)
            : null;
          await this.mailService.sendEsimPurchase({
            to: user.email,
            esimId: esim.id,
            qrAccessToken: esim.qrAccessToken ?? null,
            iccid: esim.iccid,
            activationCode: esim.activationCode ?? '',
            lpa: esim.lpa ?? '',
            smdpAddress: esim.smdpAddress ?? '',
            apn: plan?.apn ?? '',
            phoneNumber: esim.phoneNumber ?? null,
            planName: plan?.name ?? '',
            orderNumber: orderId,
          });
        }
      }
    } catch (err) {
      this.logger.error(
        `[Billion] Failed to send purchase email: ${(err as Error).message}`,
      );
    }
  }

  /** LPA format: `LPA:1$<smdpAddress>$<activationCode>`. */
  private extractSmdpFromLpa(lpa: string): string | null {
    const parts = lpa.split('$');
    return parts.length >= 2 && parts[1] ? parts[1] : null;
  }

  private extractActivationCodeFromLpa(lpa: string): string | null {
    const idx = lpa.lastIndexOf('$');
    return idx >= 0 && idx < lpa.length - 1 ? lpa.substring(idx + 1) : null;
  }
}
