import { registerAs } from '@nestjs/config';
import { SepayConfig } from './sepay-config.type';

/**
 * SePay integration config (bank-transfer auto-reconciliation). The receiving
 * bank is whatever `SEPAY_BANK_CODE` names — it reaches both the VietQR image
 * and the bank label shown to the buyer.
 *
 * Unlike OnePay, these are intentionally NOT validated as required: the app
 * must still boot when SePay is not yet configured (e.g. local dev). Instead,
 * the webhook handler and bank-transfer checkout refuse to operate while
 * `webhookApiKey` / `accountNumber` are empty, so an unconfigured deploy fails
 * closed at the feature level rather than crashing the whole server on start.
 */
export default registerAs<SepayConfig>('sepay', () => ({
  webhookApiKey: process.env.SEPAY_WEBHOOK_APIKEY || '',
  accountNumber: process.env.SEPAY_ACCOUNT_NUMBER || '',
  accountName: process.env.SEPAY_ACCOUNT_NAME || '',
  bankCode: process.env.SEPAY_BANK_CODE || 'VietinBank',
}));
