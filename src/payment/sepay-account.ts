import { SepayConfig } from './config/sepay-config.type';

/**
 * Which SePay-linked account a transfer goes to (vande-1411 #046): the
 * personal VietinBank one, or the company one. Chosen per partner by an admin;
 * a marketing partner's customers and a distribution partner's deposits get
 * the QR of that account.
 */
export const SEPAY_ACCOUNT_KEYS = ['personal', 'company'] as const;
export type SepayAccountKey = (typeof SEPAY_ACCOUNT_KEYS)[number];

export type SepayReceivingAccount = {
  key: SepayAccountKey;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  memoPrefix: string;
};

/** True when the company account is set up in the environment. */
export function companyAccountConfigured(config: SepayConfig): boolean {
  return Boolean(config.company?.accountNumber);
}

/**
 * The account to show the payer. "company" falls back to the personal account
 * until `SEPAY_COMPANY_ACCOUNT_NUMBER` is set, so no one is shown an empty QR.
 */
export function sepayAccountFor(
  config: SepayConfig,
  wanted?: string | null,
): SepayReceivingAccount {
  if (wanted === 'company' && companyAccountConfigured(config)) {
    const company = config.company;
    return {
      key: 'company',
      accountNumber: company.accountNumber,
      accountName: company.accountName || config.accountName,
      bankCode: company.bankCode || config.bankCode,
      memoPrefix: company.memoPrefix,
    };
  }
  return {
    key: 'personal',
    accountNumber: config.accountNumber,
    accountName: config.accountName,
    bankCode: config.bankCode,
    memoPrefix: config.memoPrefix,
  };
}

const digits = (value: string | null | undefined) =>
  String(value ?? '').replace(/\D/g, '');

/**
 * Whether a transfer reached the account its QR named. Money that clearly
 * landed on the OTHER configured account is held for an admin; a number we
 * cannot tell apart (none sent, or one SePay formats its own way, such as a
 * virtual account) is let through, as before this feature.
 */
export function landedOnExpectedAccount(
  config: SepayConfig,
  expected: string | null | undefined,
  receivedAccountNumber: string | null | undefined,
): boolean {
  const received = digits(receivedAccountNumber);
  if (!received || !expected || !companyAccountConfigured(config)) return true;
  const personal = digits(config.accountNumber);
  const company = digits(config.company.accountNumber);
  if (expected === 'company') return received !== personal || !personal;
  return received !== company;
}
