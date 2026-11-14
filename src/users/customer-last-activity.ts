/**
 * A customer's latest act and what it was (vande-1411 #043), the customer
 * list's "Hoạt động gần nhất", like the partner list's (doitac-3010 #035).
 * Null when there is none.
 */
const KINDS: [string, string][] = [
  ['lastLoginAt', 'Đăng nhập'],
  ['lastOrderAt', 'Đặt hàng'],
  ['lastTicketAt', 'Gửi yêu cầu hỗ trợ'],
  ['lastChatAt', 'Nhắn tin hỗ trợ'],
];

export function customerLastActivity(
  row: Record<string, unknown> | undefined,
): { lastActivityAt: Date | null; lastActivityLabel: string | null } {
  let best: { at: Date; label: string } | null = null;
  for (const [key, label] of KINDS) {
    const value = row?.[key];
    if (!value) continue;
    const at = new Date(value as string | Date);
    if (Number.isNaN(at.getTime())) continue;
    if (!best || at > best.at) best = { at, label };
  }
  return {
    lastActivityAt: best?.at ?? null,
    lastActivityLabel: best?.label ?? null,
  };
}
