import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AllConfigType } from '../config/config.type';

export interface OnePayCheckoutParams {
  orderNumber: string;
  vndAmount: number; // integer VND (e.g. 123000)
  locale?: string;
  clientIp: string;
  orderInfo?: string;
  againLink?: string;
  title?: string;
}

@Injectable()
export class OnepayService {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  buildPaymentUrl(params: OnePayCheckoutParams): string {
    const cfg = this.configService.getOrThrow('onepay', { infer: true });

    const amount = String(Math.round(params.vndAmount) * 100);

    const vpcParams: Record<string, string> = {
      vpc_Version: '2',
      vpc_Command: 'pay',
      vpc_AccessCode: cfg.accessCode,
      vpc_Merchant: cfg.merchantId,
      vpc_Locale: params.locale ?? 'vn',
      vpc_ReturnURL: cfg.returnUrl,
      vpc_CallbackURL: cfg.ipnUrl,
      vpc_MerchTxnRef: params.orderNumber,
      vpc_OrderInfo: params.orderInfo ?? params.orderNumber,
      vpc_Amount: amount,
      vpc_Currency: 'VND',
      vpc_TicketNo: params.clientIp,
    };

    const hash = this.createSecureHash(vpcParams, cfg.hashSecret);

    const allParams: Record<string, string> = {
      ...vpcParams,
      AgainLink: params.againLink ?? cfg.returnUrl,
      Title: params.title ?? 'eSIM Payment',
      vpc_SecureHash: hash,
    };

    const urlQuery = Object.entries(allParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    return `${cfg.payUrl}?${urlQuery}`;
  }

  verifyIpn(query: Record<string, string>): boolean {
    const cfg = this.configService.getOrThrow('onepay', { infer: true });
    const receivedHash = query['vpc_SecureHash'];
    if (!receivedHash) return false;

    const paramsWithoutHash = { ...query };
    delete paramsWithoutHash['vpc_SecureHash'];

    const expected = this.createSecureHash(paramsWithoutHash, cfg.hashSecret);
    return expected === receivedHash;
  }

  isPaymentSuccess(query: Record<string, string>): boolean {
    return query['vpc_TxnResponseCode'] === '0';
  }

  private createSecureHash(
    params: Record<string, string>,
    hashSecret: string,
  ): string {
    const sortedKeys = Object.keys(params)
      .filter((k) => k.startsWith('vpc_'))
      .sort();

    const hashData = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');

    const secretBytes = Buffer.from(hashSecret, 'hex');
    return crypto
      .createHmac('sha256', secretBytes)
      .update(hashData)
      .digest('hex')
      .toUpperCase();
  }
}
