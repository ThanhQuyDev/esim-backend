/**
 * Helpers for the SePay bank-transfer payment flow. The receiving bank comes
 * from `SEPAY_BANK_CODE`, so nothing here is tied to one bank.
 *
 * The transfer *content* (memo) is the only reliable field we can match an
 * incoming transfer back to an order with, so we embed a short, bank-safe code
 * in it. Banks routinely strip diacritics and punctuation from the memo, so the
 * code is uppercase [A-Z0-9] only and we normalise both sides before matching.
 */

/** Prefix that marks one of our transfer codes inside a free-form memo. */
export const BANK_TRANSFER_CODE_PREFIX = 'ESIM';

/** Regex that finds our code inside a normalised memo, e.g. "ESIM7K2M9P". */
export const BANK_TRANSFER_CODE_REGEX = /ESIM[A-Z0-9]{6}/;

/**
 * Generate a short unique-ish transfer code: `ESIM` + 6 base36 chars, e.g.
 * `ESIM7K2M9P`. Uniqueness is enforced by the DB partial-unique index; callers
 * should retry on the (astronomically rare) collision.
 */
export function generateBankTransferCode(): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += Math.floor(Math.random() * 36)
      .toString(36)
      .toUpperCase();
  }
  return `${BANK_TRANSFER_CODE_PREFIX}${suffix}`;
}

/**
 * Normalise a bank memo for matching: uppercase and strip everything that is
 * not A-Z or 0-9. Mirrors how banks mangle the transfer content.
 */
export function normalizeTransferContent(content: string): string {
  return (content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Extract our transfer code from a raw bank memo, or null if none is present.
 */
export function extractBankTransferCode(content: string): string | null {
  const normalized = normalizeTransferContent(content);
  const match = normalized.match(BANK_TRANSFER_CODE_REGEX);
  return match ? match[0] : null;
}

/**
 * What the buyer types as the transfer memo: our code, after the word SePay
 * needs to see in it (`SEVQR` for a personal VietinBank account). The webhook
 * still finds the code, since {@link extractBankTransferCode} searches the
 * whole memo.
 */
export function buildTransferMemo(code: string, prefix: string): string {
  const word = (prefix || '').trim();
  return word ? `${word} ${code}` : code;
}

/**
 * Build a VietQR image URL (img.vietqr.io) encoding the account, amount and
 * transfer memo so any Vietnamese banking app can scan-to-pay with the fields
 * pre-filled.
 */
export function buildVietQrUrl(params: {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amountVnd: number;
  transferCode: string;
}): string {
  const { bankCode, accountNumber, accountName, amountVnd, transferCode } =
    params;
  const base = `https://img.vietqr.io/image/${encodeURIComponent(
    bankCode,
  )}-${encodeURIComponent(accountNumber)}-compact2.png`;
  const qs = new URLSearchParams({
    amount: String(Math.round(amountVnd)),
    addInfo: transferCode,
    accountName,
  });
  return `${base}?${qs.toString()}`;
}
