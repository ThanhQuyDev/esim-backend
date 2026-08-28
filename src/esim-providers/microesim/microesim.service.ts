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
  MicroEsimApiResponse,
  MicroEsimDataplan,
  MicroEsimDataplanListPage,
  MicroEsimDeviceDetailResult,
  MicroEsimSubscribeResult,
  MicroEsimTopupDetailResult,
} from './microesim-api.types';

const PROVIDER = 'microesim';
/** Fallback HKD→USD rate if the live exchange lookup fails. */
const HKD_TO_USD_FALLBACK = 0.128;

/**
 * MicroEsim recharge (topup-into-existing-eSIM) endpoint path.
 *
 * ⚠️ Deliberately empty: the public "MICROESIM OPEN API V1" collection exposes
 * NO recharge endpoint. Its full surface is esimDataplanList(Page),
 * esimSubscribe (creates a NEW eSIM — takes only channel_dataplan_id + number,
 * cannot target an existing device_id/iccid), topupDetail/deviceDetail/
 * eventDetail (queries), and account endpoints. The word "topup" in their docs
 * refers to `topup_id` (= an order id) and `topupDetail` (= order progress),
 * NOT to adding data to a live eSIM. Verified against the official Postman
 * collection on 2026-08-25.
 *
 * While empty, {@link MicroEsimService.submitTopup} throws, so a paid MicroEsim
 * topup routes to MANUAL_INTERVENTION rather than firing a guessed endpoint.
 * Only set this if MicroEsim later supplies a real recharge path (and confirm
 * the form fields — the body below is an unverified placeholder).
 */
const MICROESIM_TOPUP_PATH = '';

@Injectable()
export class MicroEsimService {
  private readonly logger = new Logger(MicroEsimService.name);

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

  /**
   * Build the signed request headers.
   *
   * Signature scheme (per MicroEsim docs):
   *   hexKey = PBKDF2-SHA256(secret, salt_hex, iterations=1024, keyLen=32) → hex
   *   sign   = HMAC-SHA256(account + nonce + timestamp, utf8(hexKey)) → hex
   */
  private signHeaders(): Record<string, string> {
    const account = this.configService.getOrThrow('microEsim.account', {
      infer: true,
    });
    const secret = this.configService.getOrThrow('microEsim.secret', {
      infer: true,
    });
    const saltHex = this.configService.getOrThrow('microEsim.salt', {
      infer: true,
    });

    const nonce = crypto.randomBytes(8).toString('hex'); // 16 chars, in 6–20 range
    const timestamp = Date.now().toString();

    const salt = Buffer.from(saltHex, 'hex');
    const hexKey = crypto
      .pbkdf2Sync(secret, salt, 1024, 32, 'sha256')
      .toString('hex');

    const signature = crypto
      .createHmac('sha256', Buffer.from(hexKey, 'utf-8'))
      .update(account + nonce + timestamp)
      .digest('hex');

    return {
      'MICROESIM-ACCOUNT': account,
      'MICROESIM-NONCE': nonce,
      'MICROESIM-TIMESTAMP': timestamp,
      'MICROESIM-SIGN': signature,
    };
  }

  private get baseUrl(): string {
    return this.configService.getOrThrow('microEsim.baseUrl', { infer: true });
  }

  /**
   * Signed GET. `code !== 1` throws.
   */
  private async get<T>(path: string): Promise<T> {
    const { data } = await firstValueFrom(
      this.httpService.get<MicroEsimApiResponse<T>>(`${this.baseUrl}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.signHeaders(),
        },
      }),
    );

    if (data.code !== 1) {
      throw new Error(`MicroEsim API error: ${data.code} - ${data.msg}`);
    }
    return data.result as T;
  }

  /**
   * Signed POST with an `application/x-www-form-urlencoded` body. `code !== 1` throws.
   */
  private async postForm<T>(
    path: string,
    form: Record<string, string | number | undefined | null>,
  ): Promise<T> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      body.append(key, value == null ? '' : String(value));
    }

    const { data } = await firstValueFrom(
      this.httpService.post<MicroEsimApiResponse<T>>(
        `${this.baseUrl}${path}`,
        body.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...this.signHeaders(),
          },
        },
      ),
    );

    if (data.code !== 1) {
      throw new Error(`MicroEsim API error: ${data.code} - ${data.msg}`);
    }
    return data.result as T;
  }

  // ─── Catalogue sync ──────────────────────────────────────────────────────

  async syncPlans(): Promise<void> {
    this.logger.log('Starting microesim plan sync...');
    const syncStartedAt = new Date();

    const syncLog = await this.providerSyncLogsService.create({
      provider: PROVIDER,
      syncType: 'plans',
      status: 'started',
      startedAt: new Date(),
    });

    try {
      const plans = await this.fetchAllPlans();
      const hkdToUsd = await this.getHkdToUsdRate();
      let itemsSynced = 0;

      for (const item of plans) {
        try {
          await this.processPlan(item, hkdToUsd);
          itemsSynced++;
        } catch (error: any) {
          this.logger.error(
            `Failed to process microesim plan ${item.channel_dataplan_id} (${item.channel_dataplan_name}): ${error.message}`,
            error.stack,
          );

          await this.providerSyncLogsService.update(syncLog.id, {
            status: 'failed',
            itemsSynced,
            errorMessage: `Plan ${item.channel_dataplan_id}: ${error.message}`,
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
        `MicroEsim plan sync completed. ${itemsSynced}/${plans.length} plans synced.`,
      );
    } catch (error: any) {
      await this.providerSyncLogsService.update(syncLog.id, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      });
      this.logger.error(`MicroEsim plan sync failed: ${error.message}`);
    }
  }

  private async fetchAllPlans(): Promise<MicroEsimDataplan[]> {
    const pageSize = 500;
    const all: MicroEsimDataplan[] = [];
    let pageNo = 1;
    let totalPages = 1;

    do {
      const page = await this.get<MicroEsimDataplanListPage>(
        `/allesim/v1/esimDataplanListPage?pageNo=${pageNo}&pageSize=${pageSize}`,
      );
      all.push(...(page.list ?? []));
      totalPages = page.totalPages ?? 1;
      pageNo++;
    } while (pageNo <= totalPages);

    return all;
  }

  private async processPlan(
    item: MicroEsimDataplan,
    hkdToUsd: number,
  ): Promise<void> {
    const codes = (item.code ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isRegion = codes.length > 1;

    if (isRegion) {
      const region = await this.resolveRegion(item, codes);
      await this.upsertPlan(item, null, region.id, hkdToUsd);
    } else {
      const destination = await this.resolveDestinationByCode(codes[0] || '');
      await this.upsertPlan(item, destination.id, null, hkdToUsd);
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

  private async resolveRegion(item: MicroEsimDataplan, codes: string[]) {
    // Stable identity key so the CMS can rename without detaching plans.
    const externalCode = `microesim-${codes
      .map((c) => c.toLowerCase())
      .join('-')}`;
    const existing = await this.regionsService.findByExternalCode(externalCode);

    let region: { id: number };
    if (existing) {
      region = existing;
    } else {
      try {
        region = await this.regionsService.create({
          name: item.code,
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
    item: MicroEsimDataplan,
    destinationId: number | null,
    regionId: number | null,
    hkdToUsd: number,
  ) {
    const { type, dataMb } = this.parseDataAndType(item);
    const days = item.day;

    const locationCode = (item.code ?? '').split(',')[0]?.trim() || item.code;
    const slug = this.buildPlanSlug(
      regionId ? item.code.replace(/,/g, '-') : locationCode,
      dataMb,
      days,
      type,
    );

    const existing = await this.plansService.findBySlug(slug);

    const rawPrice = parseFloat(item.price) || 0;
    const currency = (item.currency || 'USD').toUpperCase();
    // The vndPrice job treats any non-VND currency as USD, so normalise HKD → USD.
    const costPrice = currency === 'HKD' ? rawPrice * hkdToUsd : rawPrice;

    const isKyc = (item.special_desc ?? '').toLowerCase().includes('ekyc');

    const planData = {
      provider: PROVIDER,
      providerPlanId: item.channel_dataplan_id,
      name: item.channel_dataplan_name,
      countryCode: destinationId ? item.code : null,
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
      operatorName: this.parseOperators(item.networks) || null,
      fupSpeed: item.rule_desc || null,
      isAbleMultidate: false,
      isKyc,
      apn: item.apn || null,
      hotSpot: true,
      hotSpotAllow: this.formatHotSpotAllow(type, dataMb),
      lastSyncedAt: new Date(),
      isActive: item.status === '1',
    };

    if (existing) {
      return this.plansService.update(existing.id, planData);
    }

    return this.plansService.create({ ...planData, slug });
  }

  /**
   * Derive the plan `type` and `dataMb` from the loosely-typed catalogue fields.
   * Unlimited plans report `data: 'unlimited'`; a throttled rule (<1 Mbps in
   * `rule_desc`) maps to `unlimited-reduce`. Fixed-quota plans encode the size
   * in `data` (e.g. '1GB') or, failing that, in the plan name.
   */
  private parseDataAndType(item: MicroEsimDataplan): {
    type: string;
    dataMb: number;
  } {
    const data = (item.data ?? '').trim().toLowerCase();

    if (data.includes('unlimited')) {
      const rule = (item.rule_desc ?? '').toLowerCase();
      const mbpsMatch = rule.match(/([\d.]+)\s*mbps/);
      const kbpsMatch = rule.match(/([\d.]+)\s*kbps/);
      const throttled =
        (kbpsMatch && parseFloat(kbpsMatch[1]) > 0) ||
        (mbpsMatch && parseFloat(mbpsMatch[1]) < 1);
      return { type: throttled ? 'unlimited-reduce' : 'unlimited', dataMb: 0 };
    }

    const dataMb =
      this.parseDataMb(item.data) ||
      this.parseDataMb(item.channel_dataplan_name);
    return { type: 'fixed', dataMb };
  }

  /** Parse a data allowance like '1GB', '500MB', 'Total1GB' → MB. */
  private parseDataMb(text: string | undefined): number {
    if (!text) return 0;
    const match = text.match(/([\d.]+)\s*(gb|mb)/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    return match[2].toLowerCase() === 'gb'
      ? Math.round(value * 1024)
      : Math.round(value);
  }

  /** Extract operator names from a networks string like 'JP:Docomo(IIJ)[4G]|'. */
  private parseOperators(networks: string | undefined): string {
    if (!networks) return '';
    return networks
      .split('|')
      .map((seg) => seg.trim())
      .filter(Boolean)
      .map((seg) => {
        const colon = seg.indexOf(':');
        const namePart = colon >= 0 ? seg.slice(colon + 1) : seg;
        return namePart.replace(/\[.*?\]/g, '').trim();
      })
      .filter(Boolean)
      .join(',');
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
    return `${code}${dataLabel}-${days}days-${type}-mi`;
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /** Fetch a live HKD→USD rate; fall back to a constant on failure. */
  private async getHkdToUsdRate(): Promise<number> {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/HKD');
      if (!res.ok) return HKD_TO_USD_FALLBACK;
      const data = await res.json();
      const rate: number | undefined = data?.rates?.USD;
      return rate && rate > 0 ? rate : HKD_TO_USD_FALLBACK;
    } catch {
      return HKD_TO_USD_FALLBACK;
    }
  }

  // ─── Orders / provisioning ───────────────────────────────────────────────

  /**
   * Place an order (subscribe). Returns the provider `topup_id`.
   */
  async submitOrder(params: {
    channelDataplanId: string;
    number: number;
    customOrderNo?: string;
    notifyUrl?: string;
  }): Promise<string> {
    this.logger.log(
      `Submitting MicroEsim order: dataplan=${params.channelDataplanId}, number=${params.number}`,
    );

    const result = await this.postForm<MicroEsimSubscribeResult>(
      '/allesim/v1/esimSubscribe',
      {
        number: params.number,
        channel_dataplan_id: params.channelDataplanId,
        custom_order_no: params.customOrderNo,
        notify_url: params.notifyUrl,
      },
    );

    this.logger.log(`MicroEsim order submitted: topup_id=${result.topup_id}`);
    return result.topup_id;
  }

  /** Query full order detail by topup_id (parallel arrays, one entry per eSIM). */
  async getTopupDetail(topupId: string): Promise<MicroEsimTopupDetailResult> {
    return this.postForm<MicroEsimTopupDetailResult>(
      '/allesim/v1/topupDetail',
      { topup_id: topupId },
    );
  }

  /** Query one eSIM's detail (usage/status) by topup_id + device_id. */
  async getDeviceDetail(
    topupId: string,
    deviceId: string,
  ): Promise<MicroEsimDeviceDetailResult> {
    return this.postForm<MicroEsimDeviceDetailResult>(
      '/allesim/v1/deviceDetail',
      { topup_id: topupId, device_id: deviceId },
    );
  }

  /**
   * Terminate (cancel) an eSIM. Best-effort — logs and swallows errors so the
   * cancellation flow is never blocked by a provider-side failure.
   */
  async terminate(topupId: string, deviceId: string): Promise<void> {
    try {
      await this.postForm('/allesim/v1/terminate', {
        topup_id: topupId,
        device_id: deviceId,
      });
      this.logger.log(
        `MicroEsim terminated: topup_id=${topupId}, device_id=${deviceId}`,
      );
    } catch (err) {
      this.logger.error(
        `MicroEsim terminate failed (topup_id=${topupId}, device_id=${deviceId}): ${(err as Error).message}`,
      );
    }
  }

  // ─── Topup / recharge an existing eSIM ─────────────────────────────────────

  /**
   * Recharge an existing MicroEsim eSIM with a new data plan (topup).
   *
   * ⚠️ NOT SUPPORTED by the current MicroEsim public API. The official
   * collection has no recharge endpoint (see {@link MICROESIM_TOPUP_PATH}) —
   * `esimSubscribe` only creates a brand-new eSIM and cannot target an existing
   * `device_id`/`iccid`. This method therefore always throws while
   * {@link MICROESIM_TOPUP_PATH} is empty, so a paid MicroEsim topup routes to
   * MANUAL_INTERVENTION (admin retries or refunds) instead of silently failing
   * against a guessed endpoint.
   *
   * The signed-`postForm` body below is kept as an unverified scaffold in case
   * MicroEsim later ships a real recharge path; do not enable it without their
   * spec, since this fires AFTER the customer has paid.
   *
   * @returns the recharge `topup_id` (order reference) returned by the provider.
   */
  async submitTopup(params: {
    topupId: string;
    deviceId: string;
    channelDataplanId: string;
    customOrderNo?: string;
    notifyUrl?: string;
  }): Promise<string> {
    if (!MICROESIM_TOPUP_PATH) {
      throw new Error(
        'MicroEsim has no recharge endpoint in its public API — topping up an ' +
          `existing eSIM (device_id=${params.deviceId}) is not supported. ` +
          'Refusing to call the API to avoid a paid-but-failed order; this ' +
          'order needs manual intervention (retry via a new eSIM order or ' +
          'refund). If MicroEsim later provides a recharge path, set ' +
          'MICROESIM_TOPUP_PATH and confirm the form fields.',
      );
    }

    this.logger.log(
      `Submitting MicroEsim topup: topup_id=${params.topupId}, device_id=${params.deviceId}, dataplan=${params.channelDataplanId}`,
    );

    // NOTE: form shape below is a best-effort placeholder mirroring esimSubscribe
    // + device targeting. Confirm field names against the recharge spec before
    // enabling.
    const result = await this.postForm<MicroEsimSubscribeResult>(
      MICROESIM_TOPUP_PATH,
      {
        topup_id: params.topupId,
        device_id: params.deviceId,
        channel_dataplan_id: params.channelDataplanId,
        custom_order_no: params.customOrderNo,
        notify_url: params.notifyUrl,
      },
    );

    this.logger.log(`MicroEsim topup submitted: topup_id=${result.topup_id}`);
    return result.topup_id;
  }

  // ─── Provisioning (async callback + poll fallback) ─────────────────────────

  /**
   * Schedule a poll of `topupDetail` ~60s after order submission, as a fallback
   * in case the async callback to our webhook is delayed or lost.
   * Called from OrdersService right after a successful `submitOrder`.
   */
  scheduleCallbackAfterSubmit(topupIds: string[]): void {
    const ids = topupIds.filter(Boolean);
    if (ids.length === 0) return;

    this.logger.log(
      `[MicroEsim] Scheduling topupDetail poll in 60s for: ${ids.join(', ')}`,
    );

    setTimeout(() => {
      void (async () => {
        for (const topupId of ids) {
          try {
            await this.provisionFromTopupDetail(topupId);
          } catch (err) {
            this.logger.error(
              `[MicroEsim] Scheduled poll failed for topup_id=${topupId}: ${(err as Error).message}`,
            );
          }
        }
      })();
    }, 60_000);
  }

  /**
   * Cron fallback: poll every remaining pending MicroEsim order item so an eSIM
   * is eventually provisioned even if both the callback and the 60s poll missed.
   */
  @Cron('*/30 * * * * *')
  async pollPendingCallbacks(): Promise<void> {
    try {
      const pendingItems =
        await this.orderItemsService.findPendingByProvider(PROVIDER);
      const topupIds = [
        ...new Set(
          pendingItems
            .map((item) => item.orderRequestId)
            .filter((id): id is string => id != null),
        ),
      ];
      if (topupIds.length === 0) return;

      this.logger.log(
        `[MicroEsim Poll] Polling ${topupIds.length} pending topup_id(s)`,
      );
      for (const topupId of topupIds) {
        try {
          await this.provisionFromTopupDetail(topupId);
        } catch (err) {
          this.logger.error(
            `[MicroEsim Poll] Failed for topup_id=${topupId}: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `[MicroEsim Poll] pollPendingCallbacks failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Handle an async callback pushed to our webhook. The callback describes a
   * single eSIM (scalar fields); we provision it. Idempotent on device_id.
   */
  async handleCallback(payload: {
    topup_id?: string;
    device_id?: string;
    lpa_str?: string;
    qrcode?: string;
    ios_esim_install_link?: string;
    msisdn?: string;
  }): Promise<void> {
    const topupId = payload.topup_id;
    if (!topupId) {
      this.logger.warn('[MicroEsim] Callback missing topup_id');
      return;
    }
    // The callback may only carry one device; re-query full detail so all eSIMs
    // for the order are provisioned consistently and idempotently.
    await this.provisionFromTopupDetail(topupId);
  }

  /**
   * Provision every eSIM for a topup order by querying `topupDetail` and
   * upserting each device. Idempotent — safe to call from the callback, the 60s
   * poll, and the cron poll concurrently.
   */
  async provisionFromTopupDetail(topupId: string): Promise<void> {
    const orderItems =
      await this.orderItemsService.findByOrderRequestId(topupId);
    if (orderItems.length === 0) {
      this.logger.warn(
        `[MicroEsim] No order item found for topup_id=${topupId}`,
      );
      return;
    }

    // All order items sharing a topup_id belong to the same order/plan.
    const orderItem = orderItems[0];
    const order = await this.ordersService.findById(orderItem.orderId);
    const userId = order?.userId ?? null;
    const plan = await this.plansService.findById(orderItem.planId);

    let detail: MicroEsimTopupDetailResult;
    try {
      detail = await this.getTopupDetail(topupId);
    } catch (err) {
      this.logger.error(
        `[MicroEsim] topupDetail failed for topup_id=${topupId}: ${(err as Error).message}`,
      );
      return;
    }

    const deviceIds = detail.device_ids ?? [];
    if (deviceIds.length === 0) {
      // Not provisioned yet — leave pending for the next poll.
      this.logger.log(
        `[MicroEsim] topup_id=${topupId} not ready yet (no devices)`,
      );
      return;
    }

    let anyCreated = false;
    for (let i = 0; i < deviceIds.length; i++) {
      const deviceId = deviceIds[i];
      if (!deviceId) continue;

      const lpa = detail.lpa_str?.[i] ?? null;
      const smdpAddress = lpa ? this.extractSmdpFromLpa(lpa) : null;
      const activationCode = lpa
        ? this.extractActivationCodeFromLpa(lpa)
        : null;
      const qrcode = detail.qrcode?.[i] ?? null;
      const iosLink = detail.ios_esim_install_link?.[i] ?? null;
      const msisdn = detail.msisdn?.[i] ?? null;

      let dataTotal: string | null = null;
      if (plan?.dataMb != null && plan.dataMb > 0) {
        dataTotal =
          plan.dataMb >= 1024 ? `${plan.dataMb / 1024}GB` : `${plan.dataMb}MB`;
      }

      // MicroEsim does not return a distinct ICCID in the order detail; the
      // device_id is the stable per-eSIM identifier, so we key on it for both
      // `iccid` (dedupe) and `esimTranNo` (usage/terminate lookups).
      const existing = await this.esimsService.findByIccid(deviceId);
      if (existing) {
        await this.esimsService.update(existing.id, {
          smdpAddress: smdpAddress ?? existing.smdpAddress ?? undefined,
          activationCode:
            activationCode ?? existing.activationCode ?? undefined,
          lpa: lpa ?? existing.lpa ?? undefined,
          qrcode: qrcode ?? existing.qrcode ?? undefined,
          directAppleInstallationUrl:
            iosLink ?? existing.directAppleInstallationUrl ?? undefined,
          apnValue: plan?.apn ?? existing.apnValue ?? undefined,
          phoneNumber: msisdn ?? existing.phoneNumber ?? undefined,
          status: 'available',
          userId: userId ?? existing.userId ?? undefined,
          orderItemId: orderItem.id,
          planId: orderItem.planId,
          esimTranNo: deviceId,
          provider: PROVIDER,
          dataTotal: dataTotal ?? existing.dataTotal ?? undefined,
        });
        continue;
      }

      await this.esimsService.create({
        iccid: deviceId,
        smdpAddress,
        activationCode,
        lpa,
        qrcode,
        directAppleInstallationUrl: iosLink,
        apnValue: plan?.apn ?? null,
        phoneNumber: msisdn,
        status: 'available',
        userId,
        orderItemId: orderItem.id,
        planId: orderItem.planId,
        esimTranNo: deviceId,
        provider: PROVIDER,
        dataUsed: '0',
        dataTotal,
      });
      anyCreated = true;
      this.logger.log(
        `[MicroEsim] eSIM created: device_id=${deviceId}, topup_id=${topupId}`,
      );
    }

    // Mark all order items for this topup completed and send the purchase email
    // once (only when we actually created new eSIMs this run, to avoid dupes).
    for (const item of orderItems) {
      await this.orderItemsService.update(item.id, {
        status: 'completed',
        providerOrderId: topupId,
        providerOrderCode: topupId,
      });
    }

    if (anyCreated) {
      await this.sendPurchaseEmails(
        userId,
        orderItems.map((i) => i.id),
        topupId,
      );
    }
  }

  /** Send the eSIM purchase email for the given order items. Best-effort. */
  private async sendPurchaseEmails(
    userId: number | null,
    orderItemIds: number[],
    topupId: string,
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
            orderNumber: topupId,
          });
        }
      }
    } catch (err) {
      this.logger.error(
        `[MicroEsim] Failed to send purchase email: ${(err as Error).message}`,
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
