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

  async submitOrder(params: {
    orderId: string;
    items: Array<{
      OrderId: string;
      wrGroup: string;
      deviceSkuId: string;
      days: number;
      startDate: string;
      email: string;
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
        start_date: item.startDate,
        email: item.email,
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

  // ─── Callback Polling ───────────────────────────────────────────────────────

  @Cron('*/2 * * * *')
  async pollPendingCallbacks(): Promise<void> {
    try {
      // Find pending order items for this provider
      const pendingItems =
        await this.orderItemsService.findPendingByProvider(PROVIDER);

      // Filter items that have orderRequestId (channelOrderId)
      const itemsToCheck = pendingItems.filter(
        (item) => item.orderRequestId != null,
      );

      if (itemsToCheck.length === 0) return;

      this.logger.log(
        `Polling JapanTravelSim callbacks for ${itemsToCheck.length} pending items`,
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

    const { data } = await firstValueFrom(
      this.httpService.post<JapanTravelSimCallbackResponse>(
        `${config.baseUrl}/api/v2/callback.php`,
        body,
        { headers: { 'Content-Type': 'application/json' } },
      ),
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

    if (result.status === 0) {
      // Complete — create eSIM record
      await this.handleOrderComplete(result, orderItem);
    } else if (result.status === 2) {
      // Cancelled
      await this.orderItemsService.update(orderItem.id, {
        status: 'failed',
      });
      this.logger.log(
        `JapanTravelSim order cancelled: channelOrderId=${result.channelOrderId}`,
      );
    }
    // If uid is empty (pending), do nothing — will retry next poll
  }

  private async handleOrderComplete(
    result: JapanTravelSimCallbackResponseItem,
    orderItem: { id: number; orderId: number; planId: number },
  ): Promise<void> {
    // Update order item status
    await this.orderItemsService.update(orderItem.id, {
      status: 'completed',
      providerOrderId: result.OrderNo,
      providerOrderCode: result.channelOrderId,
    });

    // Parse QR code content for eSIM activation
    let smdpAddress: string | null = null;
    let activationCode: string | null = null;

    if (result.qrcodecontent) {
      const parts = result.qrcodecontent.split('$');
      if (parts.length >= 2) {
        smdpAddress = parts[1] ?? null;
        activationCode = parts[2] ?? null;
      }
    }

    // Create eSIM record
    if (result.iccid) {
      const existing = await this.esimsService.findByIccid(result.iccid);
      const order = await this.ordersService.findById(orderItem.orderId);
      const userId = order?.userId ?? null;

      if (existing) {
        await this.esimsService.update(existing.id, {
          smdpAddress: smdpAddress ?? undefined,
          activationCode: activationCode ?? undefined,
          lpa: result.qrcodecontent ?? undefined,
          qrcode: result.qrcodecontent ?? undefined,
          apnValue: result.apn ?? undefined,
          status: 'available',
          userId: userId ?? undefined,
          orderItemId: orderItem.id,
          provider: PROVIDER,
        });
      } else {
        await this.esimsService.create({
          iccid: result.iccid,
          smdpAddress,
          activationCode,
          lpa: result.qrcodecontent ?? null,
          qrcode: result.qrcodecontent ?? null,
          apnValue: result.apn ?? null,
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

      // Send purchase email
      await this.sendPurchaseEmail(userId, orderItem, result);
    }
  }

  private async sendPurchaseEmail(
    userId: number | null,
    orderItem: { id: number; orderId: number; planId: number },
    result: JapanTravelSimCallbackResponseItem,
  ): Promise<void> {
    if (!userId) return;

    try {
      const user = await this.usersService.findById(userId);
      if (!user?.email) return;

      const order = await this.ordersService.findById(orderItem.orderId);
      const plan = await this.plansService.findById(orderItem.planId);

      let smdpAddress: string | null = null;
      let activationCode: string | null = null;
      if (result.qrcodecontent) {
        const parts = result.qrcodecontent.split('$');
        if (parts.length >= 2) {
          smdpAddress = parts[1] ?? null;
          activationCode = parts[2] ?? null;
        }
      }

      await this.mailService.sendEsimPurchase({
        to: user.email,
        esimId: 0,
        iccid: result.iccid,
        activationCode: activationCode ?? '',
        lpa: result.qrcodecontent ?? '',
        smdpAddress: smdpAddress ?? '',
        apn: result.apn ?? '',
        phoneNumber: null,
        planName: plan?.name ?? '',
        orderNumber: order?.orderNumber ?? '',
      });
    } catch (err) {
      this.logger.error(
        `Failed to send purchase email: ${(err as Error).message}`,
      );
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

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
