/**
 * How a wallet line reads in "Lịch sử giao dịch" (doitac-1410 #031).
 *
 * The ledger keeps a type, a source and a free-text reason; the partner wants
 * a kind they can filter on, the code they would quote to support (order
 * number, withdrawal code, transfer reference) and a sentence that says what
 * happened — "Mua eSIM Thái Lan 10GB x 2", not "order_purchase".
 */

export type LedgerKind =
  | 'purchase'
  | 'refund'
  | 'deposit'
  | 'payout'
  | 'adjustment'
  | 'commission';

export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  purchase: 'Mua eSIM',
  refund: 'Hoàn tiền',
  deposit: 'Nạp tiền',
  payout: 'Rút tiền',
  adjustment: 'Điều chỉnh',
  commission: 'Hoa hồng',
};

/** Which kind each stored type belongs to. */
export const LEDGER_TYPES: Record<LedgerKind, string[]> = {
  purchase: ['order_purchase'],
  refund: ['order_purchase_reversal'],
  deposit: ['deposit', 'deposit_bonus'],
  payout: ['payout', 'payout_rejected'],
  adjustment: ['manual_credit', 'manual_debit', 'credit_limit_reset'],
  commission: ['commission_earned', 'commission_reversed'],
};

export function ledgerKindOf(type: string): LedgerKind {
  for (const [kind, types] of Object.entries(LEDGER_TYPES)) {
    if (types.includes(type)) return kind as LedgerKind;
  }
  return 'adjustment';
}

export type LedgerRowSource = {
  type: string;
  reason: string | null;
  orderNumber: string | null;
  items: string | null;
  payoutId: number | null;
  depositCode: string | null;
  depositMethod: string | null;
};

/** The code the partner would quote for this line. */
export function ledgerCode(row: LedgerRowSource): string | null {
  if (row.orderNumber) return row.orderNumber;
  if (row.payoutId != null)
    return `WD-${String(row.payoutId).padStart(6, '0')}`;
  if (row.depositCode) return row.depositCode;
  return null;
}

/** "Mua eSIM Thái Lan 10GB x 2", "Đối tác rút tiền", "Admin cộng tiền: …". */
export function ledgerDescription(row: LedgerRowSource): string {
  const items = row.items?.trim();
  const reason = row.reason?.trim();
  switch (row.type) {
    case 'order_purchase':
      return items ? `Mua eSIM ${items}` : (reason ?? 'Mua eSIM');
    case 'order_purchase_reversal':
      return items ? `Hoàn tiền eSIM ${items}` : (reason ?? 'Hoàn tiền eSIM');
    case 'deposit':
      return row.depositMethod === 'card'
        ? 'Xác nhận nạp ký quỹ qua thẻ tín dụng'
        : 'Xác nhận nạp ký quỹ qua chuyển khoản';
    case 'deposit_bonus':
      return reason ?? 'Khuyến mãi nạp ký quỹ';
    case 'payout':
      return 'Đối tác rút tiền';
    case 'payout_rejected':
      return 'Hoàn lại yêu cầu rút tiền bị từ chối';
    case 'manual_credit':
      return reason ? `Admin cộng tiền: ${reason}` : 'Admin cộng tiền';
    case 'manual_debit':
      return reason ? `Admin trừ tiền: ${reason}` : 'Admin trừ tiền';
    case 'credit_limit_reset':
      return reason ?? 'Đặt lại hạn mức giao dịch';
    case 'commission_earned':
      return reason ?? 'Hoa hồng được duyệt';
    case 'commission_reversed':
      return reason ?? 'Thu hồi hoa hồng (đơn hoàn/hủy)';
    default:
      return reason ?? row.type;
  }
}
