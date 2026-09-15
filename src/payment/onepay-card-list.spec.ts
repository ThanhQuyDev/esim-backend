import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { OnepayService } from './onepay.service';

/**
 * #041 — admin custom payment links open OnePay's card form directly via
 * `vpc_CardList`, and that param must be covered by the secure hash.
 */
describe('OnepayService vpc_CardList', () => {
  const cfg = {
    merchantId: 'TESTONEPAY',
    accessCode: 'ACCESS',
    hashSecret: 'A1B2C3D4E5F6',
    payUrl: 'https://mtf.onepay.vn/paygate/vpcpay.op',
    returnUrl: 'https://esim.vn/payment/result',
    ipnUrl: 'https://api.esim.vn/ipn',
    customLinkCardList: 'INTERNATIONAL',
  };
  const service = new OnepayService({
    getOrThrow: () => cfg,
  } as unknown as ConfigService);

  const base = { orderNumber: 'CPL-1', vndAmount: 10000, clientIp: '1.2.3.4' };

  function parse(url: string) {
    return Object.fromEntries(new URL(url).searchParams.entries());
  }

  function expectedHash(query: Record<string, string>) {
    const data = Object.keys(query)
      .filter((k) => k.startsWith('vpc_') && k !== 'vpc_SecureHash')
      .sort()
      .map((k) => `${k}=${query[k]}`)
      .join('&');
    return crypto
      .createHmac('sha256', Buffer.from(cfg.hashSecret, 'hex'))
      .update(data)
      .digest('hex')
      .toUpperCase();
  }

  it('should send vpc_CardList and sign it', () => {
    const query = parse(
      service.buildPaymentUrl({ ...base, cardList: 'INTERNATIONAL' }),
    );
    expect(query.vpc_CardList).toBe('INTERNATIONAL');
    expect(query.vpc_SecureHash).toBe(expectedHash(query));
    expect(service.verifyIpn(query)).toBe(true);
  });

  it('should omit vpc_CardList when not requested', () => {
    const query = parse(service.buildPaymentUrl(base));
    expect(query.vpc_CardList).toBeUndefined();
    expect(query.vpc_SecureHash).toBe(expectedHash(query));
  });
});
