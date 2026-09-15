import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { AllConfigType } from '../../config/config.type';
import {
  GadgetKoreaOrderRequest,
  GadgetKoreaOrderResponse,
  GadgetKoreaEsimData,
  GadgetKoreaQueryEsimResponse,
  GadgetKoreaTopupData,
  GadgetKoreaTopupResponse,
  GadgetKoreaExtendRequest,
  GadgetKoreaExtendResponse,
} from './gadgetkorea-api.types';

const UNIT_TO_MB: Record<string, number> = {
  B: 1 / (1024 * 1024),
  BYTE: 1 / (1024 * 1024),
  BYTES: 1 / (1024 * 1024),
  KB: 1 / 1024,
  MB: 1,
  GB: 1024,
  TB: 1024 * 1024,
};

/**
 * Megabytes used, from Gadget Korea's `usage` field (#028).
 *
 * A bare number is taken as MB (what the integration has assumed so far). A
 * value carrying a unit — "1.5GB", "2048 KB" — is converted, where a plain
 * `parseFloat` read "1.5GB" as 1.5 MB.
 */
export function parseGadgetKoreaUsageMb(
  value: string | number | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  const match = value
    .trim()
    .replace(/,/g, '')
    .match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
  if (!match) return 0;
  const amount = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const factor = unit === '' ? 1 : UNIT_TO_MB[unit];
  if (factor === undefined || !Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount * factor * 100) / 100);
}

@Injectable()
export class GadgetKoreaService {
  private readonly logger = new Logger(GadgetKoreaService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async submitOrder(params: {
    orderId: string;
    products: { optionId: string; qty: number }[];
  }): Promise<GadgetKoreaOrderResponse> {
    const baseUrl = this.configService.getOrThrow('gadgetKorea.baseUrl', {
      infer: true,
    });
    const accessKey = this.configService.getOrThrow('gadgetKorea.accessKey', {
      infer: true,
    });
    const secretKey = this.configService.getOrThrow('gadgetKorea.secretKey', {
      infer: true,
    });

    const timestamp = Date.now();
    const method = 'POST';
    const pathAndQuery = '/api/v2/order';
    const stringToSign = `${method} ${pathAndQuery}\n${timestamp}\n${accessKey}`;

    const secretKeyBuffer = Buffer.from(secretKey, 'base64');
    const signature = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(stringToSign)
      .digest('base64');

    const body: GadgetKoreaOrderRequest = {
      orderId: params.orderId,
      products: params.products,
    };

    this.logger.log(
      `Submitting order to Gadget Korea: orderId=${params.orderId}, products=${params.products.length}`,
    );

    const { data } = await firstValueFrom(
      this.httpService.post<GadgetKoreaOrderResponse>(
        `${baseUrl}${pathAndQuery}`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-gat-timestamp': String(timestamp),
            'x-gat-access-key': accessKey,
            'x-gat-signature': signature,
          },
        },
      ),
    );

    this.logger.log(`Gadget Korea order response: ${JSON.stringify(data)}`);

    return data;
  }

  async cancelOrder(orderRequestId: string): Promise<void> {
    const baseUrl = this.configService.getOrThrow('gadgetKorea.baseUrl', {
      infer: true,
    });
    const accessKey = this.configService.getOrThrow('gadgetKorea.accessKey', {
      infer: true,
    });
    const secretKey = this.configService.getOrThrow('gadgetKorea.secretKey', {
      infer: true,
    });

    const timestamp = Date.now();
    const method = 'POST';
    const pathAndQuery = `/api/v2/cancel/${orderRequestId}`;
    const stringToSign = `${method} ${pathAndQuery}\n${timestamp}\n${accessKey}`;

    const secretKeyBuffer = Buffer.from(secretKey, 'base64');
    const signature = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(stringToSign)
      .digest('base64');

    this.logger.log(
      `Cancelling Gadget Korea order: orderRequestId=${orderRequestId}`,
    );

    const { data } = await firstValueFrom(
      this.httpService.post(
        `${baseUrl}${pathAndQuery}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'x-gat-timestamp': String(timestamp),
            'x-gat-access-key': accessKey,
            'x-gat-signature': signature,
          },
        },
      ),
    );

    this.logger.log(`Gadget Korea cancel response: ${JSON.stringify(data)}`);
  }

  async queryEsim(topupId: string): Promise<GadgetKoreaEsimData> {
    const baseUrl = this.configService.getOrThrow('gadgetKorea.baseUrl', {
      infer: true,
    });
    const accessKey = this.configService.getOrThrow('gadgetKorea.accessKey', {
      infer: true,
    });
    const secretKey = this.configService.getOrThrow('gadgetKorea.secretKey', {
      infer: true,
    });

    const timestamp = Date.now();
    const method = 'GET';
    const pathAndQuery = `/api/v2/esim/${topupId}`;
    const stringToSign = `${method} ${pathAndQuery}\n${timestamp}\n${accessKey}`;

    const secretKeyBuffer = Buffer.from(secretKey, 'base64');
    const signature = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(stringToSign)
      .digest('base64');

    const { data } = await firstValueFrom(
      this.httpService.get<GadgetKoreaQueryEsimResponse>(
        `${baseUrl}${pathAndQuery}`,
        {
          headers: {
            'x-gat-timestamp': String(timestamp),
            'x-gat-access-key': accessKey,
            'x-gat-signature': signature,
          },
        },
      ),
    );

    if (data.code !== '0000') {
      throw new Error(`Gadget Korea queryEsim failed: ${data.message}`);
    }

    return data.data;
  }

  async getDataUsage(topupId: string): Promise<GadgetKoreaTopupData> {
    const baseUrl = this.configService.getOrThrow('gadgetKorea.baseUrl', {
      infer: true,
    });
    const accessKey = this.configService.getOrThrow('gadgetKorea.accessKey', {
      infer: true,
    });
    const secretKey = this.configService.getOrThrow('gadgetKorea.secretKey', {
      infer: true,
    });

    const timestamp = Date.now();
    const method = 'GET';
    // The topupId went only in a GET body, which proxies and many servers drop —
    // then no eSIM is named and no usage comes back. It now also travels in the
    // query string, signed as part of the path exactly as Gadget Korea's own
    // pre-request script signs it; the body is kept for compatibility (#028).
    const pathAndQuery = `/api/v2/topup?topupId=${encodeURIComponent(topupId)}`;
    const stringToSign = `${method} ${pathAndQuery}\n${timestamp}\n${accessKey}`;

    const secretKeyBuffer = Buffer.from(secretKey, 'base64');
    const signature = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(stringToSign)
      .digest('base64');

    this.logger.log(`Querying Gadget Korea data usage: topupId=${topupId}`);

    const { data } = await firstValueFrom(
      this.httpService.get<GadgetKoreaTopupResponse>(
        `${baseUrl}${pathAndQuery}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-gat-timestamp': String(timestamp),
            'x-gat-access-key': accessKey,
            'x-gat-signature': signature,
          },
          data: { topupId },
        },
      ),
    );

    if (data.code !== '0000') {
      throw new Error(`Gadget Korea getDataUsage failed: ${data.message}`);
    }

    return data.topup;
  }

  /**
   * Submit an extend (topup) request to Gadget Korea.
   * @see Gadget Korea docs: POST /api/v2/extend
   */
  async submitTopup(params: {
    topupId: string;
    optionId: string;
  }): Promise<GadgetKoreaExtendResponse> {
    const baseUrl = this.configService.getOrThrow('gadgetKorea.baseUrl', {
      infer: true,
    });
    const accessKey = this.configService.getOrThrow('gadgetKorea.accessKey', {
      infer: true,
    });
    const secretKey = this.configService.getOrThrow('gadgetKorea.secretKey', {
      infer: true,
    });

    const timestamp = Date.now();
    const method = 'POST';
    const pathAndQuery = '/api/v2/extend';
    const stringToSign = `${method} ${pathAndQuery}\n${timestamp}\n${accessKey}`;

    const secretKeyBuffer = Buffer.from(secretKey, 'base64');
    const signature = crypto
      .createHmac('sha256', secretKeyBuffer)
      .update(stringToSign)
      .digest('base64');

    const body: GadgetKoreaExtendRequest = {
      topupId: params.topupId,
      optionId: params.optionId,
    };

    this.logger.log(
      `Submitting Gadget Korea extend: topupId=${params.topupId}, optionId=${params.optionId}`,
    );

    const { data } = await firstValueFrom(
      this.httpService.post<GadgetKoreaExtendResponse>(
        `${baseUrl}${pathAndQuery}`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-gat-timestamp': String(timestamp),
            'x-gat-access-key': accessKey,
            'x-gat-signature': signature,
          },
        },
      ),
    );

    if (data.code !== '0000') {
      throw new Error(`Gadget Korea extend failed: ${data.message}`);
    }

    this.logger.log(`Gadget Korea extend submitted: topupId=${params.topupId}`);

    return data;
  }
}
