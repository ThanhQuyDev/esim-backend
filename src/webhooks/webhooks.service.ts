import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EsimsService } from '../esims/esims.service';
import { OrderItemsService } from '../order-items/order-items.service';
import { OrdersService } from '../orders/orders.service';
import { EsimAccessService } from '../esim-providers/esimaccess/esimaccess.service';
import { GadgetKoreaService } from '../esim-providers/gadgetkorea/gadgetkorea.service';
import { AllConfigType } from '../config/config.type';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly esimsService: EsimsService,
    private readonly orderItemsService: OrderItemsService,
    private readonly ordersService: OrdersService,
    private readonly esimAccessService: EsimAccessService,
    private readonly gadgetKoreaService: GadgetKoreaService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  // ─── Airalo ──────────────────────────────────────────────────────────────────

  verifyAiraloSignature(rawBody: Buffer, signature: string): void {
    const airaloConfig = this.configService.get('airalo', { infer: true });
    const secret = airaloConfig?.webhookSecret;
    if (!secret) return; // skip when not configured

    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;

    const trusted = Buffer.from(expected, 'utf8');
    const received = Buffer.from(signature, 'utf8');

    if (
      trusted.length !== received.length ||
      !crypto.timingSafeEqual(trusted, received)
    ) {
      throw new UnauthorizedException('Invalid Airalo webhook signature');
    }
  }

  async handleAiraloEvent(payload: any): Promise<void> {
    const requestId = payload.request_id;
    const orderData = payload.data;
    const sims = orderData?.sims;

    this.logger.log(
      `Airalo webhook received: request_id=${requestId}, code=${orderData?.code}, sims=${sims?.length ?? 0}`,
    );

    // No SIM data — just an async confirmation
    if (!sims?.length) {
      this.logger.log(
        `Airalo webhook has no SIM data (request_id=${requestId}), skipping`,
      );
      return;
    }

    // 1. Find order items by request_id to get userId and orderItemId
    let userId: number | null = null;
    let orderItemId: number | null = null;

    if (requestId) {
      const orderItems =
        await this.orderItemsService.findByOrderRequestId(requestId);

      // Update all matching order items to completed with provider order info
      for (const item of orderItems) {
        await this.orderItemsService.update(item.id, {
          status: 'completed',
          providerOrderId: orderData?.id ? String(orderData.id) : undefined,
          providerOrderCode: orderData?.code ?? undefined,
        });
      }
      this.logger.log(
        `Updated ${orderItems.length} order item(s) to completed (request_id=${requestId})`,
      );

      // Get userId from the first order item's order
      if (orderItems.length > 0) {
        orderItemId = orderItems[0].id;
        const order = await this.ordersService.findById(orderItems[0].orderId);
        userId = order?.userId ?? null;
      }
    }

    // 2. Create eSIM records from sims array
    for (const sim of sims) {
      if (!sim.iccid) continue;

      try {
        // Parse smdpAddress + activationCode from qrcode "LPA:1$<smdp>$<matching_id>"
        let smdpAddress: string | null = sim.lpa ?? null;
        let activationCode: string | null = sim.matching_id ?? null;

        if (sim.qrcode) {
          const parts = sim.qrcode.split('$');
          if (parts.length >= 2) {
            smdpAddress = parts[1] ?? smdpAddress;
            activationCode = parts[2] ?? activationCode;
          }
        }

        const existing = await this.esimsService.findByIccid(sim.iccid);

        if (existing) {
          await this.esimsService.update(existing.id, {
            smdpAddress: smdpAddress ?? existing.smdpAddress ?? undefined,
            activationCode:
              activationCode ?? existing.activationCode ?? undefined,
            lpa: sim.qrcode ?? existing.lpa ?? undefined,
            matchId: sim.matching_id ?? existing.matchId ?? undefined,
            qrcode: sim.qrcode ?? existing.qrcode ?? undefined,
            directAppleInstallationUrl:
              sim.direct_apple_installation_url ??
              existing.directAppleInstallationUrl ??
              undefined,
            apnValue: sim.apn_value ?? existing.apnValue ?? undefined,
            isRoaming: sim.is_roaming ?? existing.isRoaming ?? undefined,
            status: 'available',
            userId: userId ?? existing.userId ?? undefined,
            orderItemId: orderItemId ?? existing.orderItemId ?? undefined,
            provider: 'airalo',
          });
          this.logger.log(`Updated eSIM iccid=${sim.iccid} (Airalo)`);
        } else {
          await this.esimsService.create({
            iccid: sim.iccid,
            smdpAddress,
            activationCode,
            lpa: sim.qrcode ?? null,
            matchId: sim.matching_id ?? null,
            qrcode: sim.qrcode ?? null,
            directAppleInstallationUrl:
              sim.direct_apple_installation_url ?? null,
            apnValue: sim.apn_value ?? null,
            isRoaming: sim.is_roaming ?? null,
            status: 'available',
            userId,
            orderItemId,
            provider: 'airalo',
          });
          this.logger.log(`Created eSIM iccid=${sim.iccid} (Airalo)`);
        }
      } catch (err) {
        this.logger.error(
          `Failed to upsert eSIM iccid=${sim.iccid}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }
  }

  // ─── EsimAccess ──────────────────────────────────────────────────────────────

  verifyEsimAccessSignature(rawBody: Buffer, signature: string): void {
    const esimAccessConfig = this.configService.get('esimAccess', {
      infer: true,
    });
    const secret = esimAccessConfig?.webhookSecret;
    if (!secret) return;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const trusted = Buffer.from(expected, 'utf8');
    const received = Buffer.from(signature, 'utf8');

    if (
      trusted.length !== received.length ||
      !crypto.timingSafeEqual(trusted, received)
    ) {
      throw new UnauthorizedException('Invalid EsimAccess webhook signature');
    }
  }

  async handleEsimAccessEvent(payload: any): Promise<void> {
    const notifyType = payload.notifyType;
    const content = payload.content;
    const orderNo = content?.orderNo;
    const orderStatus = content?.orderStatus;

    this.logger.log(
      `EsimAccess webhook received: notifyType=${notifyType}, orderNo=${orderNo}, orderStatus=${orderStatus}`,
    );

    if (notifyType !== 'ORDER_STATUS' || orderStatus !== 'GOT_RESOURCE') {
      this.logger.log(
        `EsimAccess event ignored: notifyType=${notifyType}, orderStatus=${orderStatus}`,
      );
      return;
    }

    if (!orderNo) {
      this.logger.warn('EsimAccess webhook missing orderNo');
      return;
    }

    // 1. Find order items by orderNo (stored as orderRequestId)
    let userId: number | null = null;
    let orderItemId: number | null = null;

    const orderItems =
      await this.orderItemsService.findByOrderRequestId(orderNo);

    for (const item of orderItems) {
      await this.orderItemsService.update(item.id, {
        status: 'completed',
        providerOrderId: orderNo,
        providerOrderCode: orderNo,
      });
    }
    this.logger.log(
      `Updated ${orderItems.length} order item(s) to completed (orderNo=${orderNo})`,
    );

    if (orderItems.length > 0) {
      orderItemId = orderItems[0].id;
      const order = await this.ordersService.findById(orderItems[0].orderId);
      userId = order?.userId ?? null;
    }

    // 2. Query EsimAccess for eSIM details
    let esimList: any[] = [];
    try {
      esimList = await this.esimAccessService.queryEsims(orderNo);
    } catch (err) {
      this.logger.error(
        `Failed to query EsimAccess eSIMs for orderNo=${orderNo}: ${(err as Error).message}`,
      );
      return;
    }

    // 3. Upsert eSIM records
    for (const esim of esimList) {
      if (!esim.iccid) continue;

      try {
        // Parse smdpAddress + activationCode from ac field "LPA:1$<smdp>$<matchingId>"
        let smdpAddress: string | null = null;
        let activationCode: string | null = null;

        if (esim.ac) {
          const parts = esim.ac.split('$');
          if (parts.length >= 2) {
            smdpAddress = parts[1] ?? null;
            activationCode = parts[2] ?? null;
          }
        }

        const existing = await this.esimsService.findByIccid(esim.iccid);

        if (existing) {
          await this.esimsService.update(existing.id, {
            smdpAddress: smdpAddress ?? existing.smdpAddress ?? undefined,
            activationCode:
              activationCode ?? existing.activationCode ?? undefined,
            lpa: esim.ac ?? existing.lpa ?? undefined,
            qrcode: esim.qrCodeUrl ?? existing.qrcode ?? undefined,
            apnValue: esim.apn ?? existing.apnValue ?? undefined,
            status: 'available',
            userId: userId ?? existing.userId ?? undefined,
            orderItemId: orderItemId ?? existing.orderItemId ?? undefined,
            esimTranNo: esim.esimTranNo ?? existing.esimTranNo ?? undefined,
            provider: 'esimaccess',
          });
          this.logger.log(`Updated eSIM iccid=${esim.iccid} (EsimAccess)`);
        } else {
          await this.esimsService.create({
            iccid: esim.iccid,
            smdpAddress,
            activationCode,
            lpa: esim.ac ?? null,
            qrcode: esim.qrCodeUrl ?? null,
            apnValue: esim.apn ?? null,
            status: 'available',
            userId,
            orderItemId,
            esimTranNo: esim.esimTranNo ?? null,
            provider: 'esimaccess',
          });
          this.logger.log(`Created eSIM iccid=${esim.iccid} (EsimAccess)`);
        }
      } catch (err) {
        this.logger.error(
          `Failed to upsert eSIM iccid=${esim.iccid}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }
  }

  // ─── Gadget Korea ─────────────────────────────────────────────────────────────

  verifyGadgetKoreaSignature(rawBody: Buffer, signature: string): void {
    const gadgetKoreaConfig = this.configService.get('gadgetKorea', {
      infer: true,
    });
    const secret = gadgetKoreaConfig?.secretKey;
    if (!secret) return;

    const secretKeyBuffer = Buffer.from(secret, 'base64');
    const expected = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(rawBody)
      .digest('base64');

    const trusted = Buffer.from(expected, 'utf8');
    const received = Buffer.from(signature, 'utf8');

    if (
      trusted.length !== received.length ||
      !crypto.timingSafeEqual(trusted, received)
    ) {
      throw new UnauthorizedException('Invalid Gadget Korea webhook signature');
    }
  }

  async handleGadgetKoreaEvent(payload: any): Promise<void> {
    const topupId: string = payload.topupId;
    const optionId: string = payload.optionId;
    const iccid: string = payload.iccid;
    const downloadLink: string = payload.downloadLink; // "LPA:$<smdp>$<activateCode>"
    const smdp: string = payload.smdp;
    const activateCode: string = payload.activateCode;
    const qrcodeImgUrl: string = payload.qrcodeImgUrl;

    this.logger.log(
      `Gadget Korea webhook received: topupId=${topupId}, iccid=${iccid}`,
    );

    if (!topupId) {
      this.logger.warn('Gadget Korea webhook missing topupId');
      return;
    }

    // 1. Find order items by topupId (stored as orderRequestId)
    let userId: number | null = null;
    let orderItemId: number | null = null;

    const orderItems =
      await this.orderItemsService.findByOrderRequestId(topupId);

    for (const item of orderItems) {
      await this.orderItemsService.update(item.id, {
        status: 'completed',
        providerOrderId: topupId,
        providerOrderCode: optionId,
      });
    }

    if (orderItems.length > 0) {
      orderItemId = orderItems[0].id;
      const order = await this.ordersService.findById(orderItems[0].orderId);
      userId = order?.userId ?? null;
      this.logger.log(
        `Updated ${orderItems.length} order item(s) to completed (topupId=${topupId})`,
      );
    } else {
      this.logger.warn(`No order item found for topupId=${topupId}`);
    }

    if (!iccid) {
      this.logger.warn(
        `Gadget Korea webhook missing iccid for topupId=${topupId}`,
      );
      return;
    }

    // 2. Parse smdpAddress + activationCode from downloadLink "LPA:$<smdp>$<activateCode>"
    let smdpAddress: string | null = smdp ?? null;
    let activationCode: string | null = activateCode ?? null;

    if (downloadLink) {
      const parts = downloadLink.split('$');
      if (parts.length >= 2) {
        smdpAddress = parts[1] ?? smdpAddress;
        activationCode = parts[2] ?? activationCode;
      }
    }

    // 3. Upsert eSIM record
    try {
      const existing = await this.esimsService.findByIccid(iccid);

      if (existing) {
        await this.esimsService.update(existing.id, {
          smdpAddress: smdpAddress ?? existing.smdpAddress ?? undefined,
          activationCode:
            activationCode ?? existing.activationCode ?? undefined,
          lpa: downloadLink ?? existing.lpa ?? undefined,
          qrcode: qrcodeImgUrl ?? existing.qrcode ?? undefined,
          status: 'available',
          userId: userId ?? existing.userId ?? undefined,
          orderItemId: orderItemId ?? existing.orderItemId ?? undefined,
        });
        this.logger.log(`Updated eSIM iccid=${iccid} (Gadget Korea)`);
      } else {
        await this.esimsService.create({
          iccid,
          smdpAddress,
          activationCode,
          lpa: downloadLink ?? null,
          qrcode: qrcodeImgUrl ?? null,
          status: 'available',
          userId,
          orderItemId,
        });
        this.logger.log(`Created eSIM iccid=${iccid} (Gadget Korea)`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to upsert eSIM iccid=${iccid}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
