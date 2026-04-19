import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { AllConfigType } from '../../config/config.type';
import {
  GadgetKoreaOrderRequest,
  GadgetKoreaOrderResponse,
} from './gadgetkorea-api.types';

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
}
