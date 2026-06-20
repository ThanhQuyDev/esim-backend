import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { AllConfigType } from '../../config/config.type';
import { PlansService } from '../../plans/plans.service';
import { OrderItemsService } from '../../order-items/order-items.service';
import { EsimsService } from '../../esims/esims.service';
import { MailService } from '../../mail/mail.service';
import { UsersService } from '../../users/users.service';
import { OrdersService } from '../../orders/orders.service';
import {
  JapanTravelSimInsertRequest,
  JapanTravelSimInsertResponse,
  JapanTravelSimCallbackRequest,
  JapanTravelSimCallbackResponse,
  JapanTravelSimCallbackResponseItem,
} from './japantravelsim-api.types';

const PROVIDER = 'japantravelsim';
const MAX_INSERT_BATCH = 10;

@Injectable()
export class JapanTravelSimService {
  private readonly logger = new Logger(JapanTravelSimService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly plansService: PlansService,
    private readonly orderItemsService: OrderItemsService,
    private readonly esimsService: EsimsService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  // ─── Order Submission ───────────────────────────────────────────────────────

  // The JapanTravelSim INSERT API requires an `email` field, but we never send
  // the customer's personal email to the provider. A fixed internal mailbox is
  // used instead — it is never read for fulfillment (eSIM delivery is driven by
  // the callback polling → eSIM record → our own purchase email).
  private static readonly PROVIDER_EMAIL = 'esimvietnam.api@gmail.com';

  async submitOrder(params: {
    orderId: string;
    items: Array<{
      OrderId: string;
      wrGroup: string;
      deviceSkuId: string;
      days: number;
    }>;
  }): Promise<JapanTravelSimInsertResponse> {
    const config = this.getConfig();

    const body: JapanTravelSimInsertRequest = {
      mb_id: config.mbId,
      apikey: config.apiKey,
      apitoken: config.apiToken,
      data: params.items.map((item) => ({
        OrderId: item.OrderId,
        wr_group: item.wrGroup,
        deviceSkuId: item.deviceSkuId,
        days: String(item.days),
        start_date: new Date().toISOString().split('T')[0],
        email: JapanTravelSimService.PROVIDER_EMAIL,
        language: 'en_US',
      })),
    };

    this.logger.log(
      `Submitting JapanTravelSim order: ${params.items.length} items`,
    );

    const { data } = await firstValueFrom(
      this.httpService.post<JapanTravelSimInsertResponse>(
        `${config.baseUrl}/api/v2/`,
        body,
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );

    if (data.tradeCode !== '0001') {
      throw new Error(`INSERT API error: ${data.tradeCode} - ${data.tradeMsg}`);
    }

    this.logger.log(`JapanTravelSim order response: ${JSON.stringify(data)}`);

    return data;
  }

  /**
   * Schedule a callback poll 60 seconds after order submission.
   * Called from OrdersService after successfully submitting a JapanTravelSim order.
   */
  scheduleCallbackAfterSubmit(channelOrderIds: string[]): void {
    if (channelOrderIds.length === 0) return;

    this.logger.log(
      `[JTS] Scheduling callback poll in 60s for: ${channelOrderIds.join(', ')}`,
    );

    setTimeout(async () => {
      try {
        await this.pollSpecificOrders(channelOrderIds);
      } catch (err) {
        this.logger.error(
          `[JTS] Scheduled callback poll failed: ${(err as Error).message}`,
        );
      }
    }, 60_000);
  }

  /**
   * Poll specific channelOrderIds (used after submit with delay).
   */
  private async pollSpecificOrders(channelOrderIds: string[]): Promise<void> {
    const config = this.getConfig();

    const body: JapanTravelSimCallbackRequest = {
      mb_id: config.mbId,
      apikey: config.apiKey,
      apitoken: config.apiToken,
      data: channelOrderIds.map((channelOrderId) => ({ channelOrderId })),
    };

    this.logger.log(
      `[JTS] Polling specific orders: ${channelOrderIds.join(', ')}`,
    );

    const { data } = await firstValueFrom(
      this.httpService.post<JapanTravelSimCallbackResponse>(
        `${config.baseUrl}/api/v2/callback.php`,
        body,
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );

    this.logger.log(`[JTS] Callback response: ${JSON.stringify(data)}`);

    if (data.tradeCode !== '0001' || !data.data) return;

    for (const result of data.data) {
      if (!result.iccid) continue; // still pending

      // Find the order item by channelOrderId (stored as orderRequestId)
      const orderItems = await this.orderItemsService.findByOrderRequestId(
        result.channelOrderId,
      );

      for (const orderItem of orderItems) {
        if (orderItem.status !== 'pending') continue;
        await this.handleOrderComplete(result, orderItem);
      }
    }
  }

  // ─── Cron Fallback Polling ──────────────────────────────────────────────────

  @Cron('*/30 * * * * *')
  async pollPendingCallbacks(): Promise<void> {
    try {
      const pendingItems =
        await this.orderItemsService.findPendingByProvider(PROVIDER);

      this.logger.debug(
        `[JTS Poll] Found ${pendingItems.length} pending items for provider=${PROVIDER}`,
      );

      // Filter items that have orderRequestId (channelOrderId)
      const itemsToCheck = pendingItems.filter(
        (item) => item.orderRequestId != null,
      );

      if (itemsToCheck.length === 0) return;

      this.logger.log(
        `Polling JapanTravelSim callbacks for ${itemsToCheck.length} pending items: ${itemsToCheck.map((i) => i.orderRequestId).join(', ')}`,
      );

      // Batch into groups of 10 (API limit)
      for (let i = 0; i < itemsToCheck.length; i += MAX_INSERT_BATCH) {
        const batch = itemsToCheck.slice(i, i + MAX_INSERT_BATCH);
        await this.pollBatch(batch);
      }
    } catch (error: any) {
      this.logger.error(
        `JapanTravelSim callback polling failed: ${error.message}`,
      );
    }
  }

  private async pollBatch(
    items: Array<{
      id: number;
      orderId: number;
      orderRequestId: string | null;
      planId: number;
    }>,
  ): Promise<void> {
    const config = this.getConfig();

    const channelOrderIds = items
      .map((i) => i.orderRequestId)
      .filter((id): id is string => id != null);

    if (channelOrderIds.length === 0) return;

    const body: JapanTravelSimCallbackRequest = {
      mb_id: config.mbId,
      apikey: config.apiKey,
      apitoken: config.apiToken,
      data: channelOrderIds.map((channelOrderId) => ({ channelOrderId })),
    };

    this.logger.log(
      `[JTS Poll] Calling callback API with channelOrderIds: ${channelOrderIds.join(', ')}`,
    );

    const { data } = await firstValueFrom(
      this.httpService.post<JapanTravelSimCallbackResponse>(
        `${config.baseUrl}/api/v2/callback.php`,
        body,
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );

    this.logger.log(
      `[JTS Poll] Callback API response: ${JSON.stringify(data)}`,
    );

    if (data.tradeCode !== '0001' || !data.data) {
      this.logger.warn(
        `Callback API returned: ${data.tradeCode} - ${data.tradeMsg}`,
      );
      return;
    }

    for (const result of data.data) {
      await this.processCallbackResult(result, items);
    }
  }

  private async processCallbackResult(
    result: JapanTravelSimCallbackResponseItem,
    items: Array<{
      id: number;
      orderId: number;
      orderRequestId: string | null;
      planId: number;
    }>,
  ): Promise<void> {
    const orderItem = items.find(
      (i) => i.orderRequestId === result.channelOrderId,
    );
    if (!orderItem) return;

    if (result.iccid) {
      // Has iccid — order complete, create eSIM record
      await this.handleOrderComplete(result, orderItem);
    }
    // If iccid is empty, order is still pending — will retry next poll
  }

  private async handleOrderComplete(
    result: JapanTravelSimCallbackResponseItem,
    orderItem: { id: number; orderId: number; planId: number },
  ): Promise<void> {
    if (!result.iccid) return;

    // Get plan for APN and other fields
    const plan = await this.plansService.findById(orderItem.planId);

    // Parse SM-DP+ Address and Activation Code from LPA.
    // LPA format: LPA:1$<smdpAddress>$<activationCode>
    // e.g. LPA:1$TEST.YOURSIM.CO.KR$C00F00A000A0000C0EE000CD000FDB0B
    const lpa = result.qrcodecontent ?? null;
    const smdpAddress = lpa ? this.extractSmdpFromLpa(lpa) : null;
    const activationCode = lpa ? this.extractActivationCodeFromLpa(lpa) : null;

    // Create (or refresh) the eSIM record first so it shows up in
    // "list my eSIM" even if the email step fails. Both create and update
    // are idempotent on iccid, so re-running this on a retry is safe.
    const existing = await this.esimsService.findByIccid(result.iccid);
    const order = await this.ordersService.findById(orderItem.orderId);
    const userId = order?.userId ?? null;

    let esim;
    if (existing) {
      esim = await this.esimsService.update(existing.id, {
        lpa: result.qrcodecontent ?? undefined,
        smdpAddress: smdpAddress ?? undefined,
        activationCode: activationCode ?? undefined,
        apnValue: plan?.apn ?? undefined,
        status: 'available',
        userId: userId ?? undefined,
        orderItemId: orderItem.id,
        provider: PROVIDER,
      });
    } else {
      esim = await this.esimsService.create({
        iccid: result.iccid,
        smdpAddress,
        activationCode,
        lpa: result.qrcodecontent ?? null,
        qrcode: null,
        apnValue: plan?.apn ?? null,
        status: 'available',
        userId,
        orderItemId: orderItem.id,
        provider: PROVIDER,
        planId: orderItem.planId,
        dataUsed: '0',
      });
    }

    this.logger.log(
      `JapanTravelSim eSIM created: iccid=${result.iccid}, channelOrderId=${result.channelOrderId}`,
    );

    // Send the purchase email. Only mark the order item `completed` once the
    // email has actually been sent — otherwise leave it `pending` so the
    // fallback cron poller retries on the next tick. Without this gate a
    // transient mail failure would permanently lose the eSIM email because a
    // completed item is never polled again.
    const emailSent = await this.sendPurchaseEmail(
      userId,
      orderItem,
      result,
      plan,
      esim,
    );

    if (!emailSent) {
      this.logger.warn(
        `[JTS] eSIM ${result.iccid} provisioned but email not sent for order item ${orderItem.id}; leaving pending for retry`,
      );
      return;
    }

    await this.orderItemsService.update(orderItem.id, {
      status: 'completed',
      providerOrderId: result.OrderNo,
      providerOrderCode: result.channelOrderId,
    });
  }

  /**
   * Sends the eSIM purchase email.
   * @returns `true` when the email was sent OR there is genuinely no recipient
   *   to send to (no user / no email on file) — in both cases the order item
   *   can be safely marked completed. Returns `false` only on an actual send
   *   failure so the caller can leave the item pending for a retry.
   */
  private async sendPurchaseEmail(
    userId: number | null,
    orderItem: { id: number; orderId: number; planId: number },
    result: JapanTravelSimCallbackResponseItem,
    plan: any,
    esim: { id: number; qrAccessToken: string | null } | null,
  ): Promise<boolean> {
    if (!userId) return true;

    try {
      const user = await this.usersService.findById(userId);
      if (!user?.email) return true;

      const order = await this.ordersService.findById(orderItem.orderId);

      // Parse SM-DP+ Address and Activation Code from LPA for the email.
      // LPA format: LPA:1$<smdpAddress>$<activationCode>
      const lpa = result.qrcodecontent ?? '';
      const smdpAddress = lpa ? this.extractSmdpFromLpa(lpa) : null;
      const activationCode = lpa
        ? this.extractActivationCodeFromLpa(lpa)
        : null;

      await this.mailService.sendEsimPurchase({
        to: user.email,
        esimId: esim?.id ?? 0,
        qrAccessToken: esim?.qrAccessToken ?? null,
        iccid: result.iccid,
        activationCode: activationCode ?? '',
        lpa,
        smdpAddress: smdpAddress ?? '',
        apn: plan?.apn ?? '',
        phoneNumber: null,
        planName: plan?.name ?? '',
        orderNumber: order?.orderNumber ?? '',
      });
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send purchase email: ${(err as Error).message}`,
      );
      return false;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Extract SM-DP+ Address from LPA code.
   * LPA format: LPA:1$<smdpAddress>$<activationCode>
   * Returns the value between the first $_$ (i.e. between first and second $).
   */
  private extractSmdpFromLpa(lpa: string): string | null {
    const parts = lpa.split('$');
    // parts[0] = "LPA:1", parts[1] = smdpAddress, parts[2] = activationCode
    if (parts.length >= 2 && parts[1]) {
      return parts[1];
    }
    return null;
  }

  /**
   * Extract Activation Code from LPA code.
   * Returns the value after the last $ in the LPA string.
   */
  private extractActivationCodeFromLpa(lpa: string): string | null {
    const lastDollarIndex = lpa.lastIndexOf('$');
    if (lastDollarIndex >= 0 && lastDollarIndex < lpa.length - 1) {
      return lpa.substring(lastDollarIndex + 1);
    }
    return null;
  }

  private getConfig() {
    return {
      mbId: this.configService.getOrThrow('japanTravelSim.mbId', {
        infer: true,
      }),
      apiKey: this.configService.getOrThrow('japanTravelSim.apiKey', {
        infer: true,
      }),
      apiToken: this.configService.getOrThrow('japanTravelSim.apiToken', {
        infer: true,
      }),
      baseUrl: this.configService.getOrThrow('japanTravelSim.baseUrl', {
        infer: true,
      }),
    };
  }
}
