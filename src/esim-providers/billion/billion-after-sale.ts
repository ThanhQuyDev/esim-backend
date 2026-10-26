/**
 * Where a Billion after-sale (refund) request stands, from its N004 / N005
 * notices or a F020 read (vande #004). Pure, so the mapping is tested alone.
 */

export type BillionAfterSaleStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'refunded'
  | 'refund_failed';

/** Statuses after which Billion has nothing more to say. */
export const FINAL_AFTER_SALE_STATUSES: BillionAfterSaleStatus[] = [
  'rejected',
  'withdrawn',
  'refunded',
  'refund_failed',
];

/** A status change and what Billion wrote about it. */
export interface AfterSaleUpdate {
  status: BillionAfterSaleStatus;
  opinion: string | null;
}

/** An N004 (审核通知) notice: auditStatus 1 = approved, 2 = rejected. */
export function afterSaleFromN004(data: {
  auditStatus?: string | number;
  auditOpinion?: string;
}): AfterSaleUpdate | null {
  const audit = String(data?.auditStatus ?? '');
  if (audit !== '1' && audit !== '2') return null;
  return {
    status: audit === '1' ? 'approved' : 'rejected',
    opinion: data.auditOpinion?.trim() || null,
  };
}

/** An N005 (退款通知) notice: refundState 1 = refunded, 2 = failed. */
export function afterSaleFromN005(data: {
  refundState?: string | number;
  refundOpinion?: string;
}): AfterSaleUpdate | null {
  const state = String(data?.refundState ?? '');
  if (state !== '1' && state !== '2') return null;
  return {
    status: state === '1' ? 'refunded' : 'refund_failed',
    opinion: data.refundOpinion?.trim() || null,
  };
}

/**
 * A F020 read. Its codes differ from the notices': auditStatus 0 not
 * reviewed, 1 withdrawn, 2 approved, 3 rejected, 4 to be modified;
 * refundStatus 0 to be refunded, 1 refunded, 2 rejected.
 */
export function afterSaleFromF020(data: {
  auditStatus?: string | number;
  auditOpinion?: string;
  refundStatus?: string | number;
  refundOpinion?: string;
}): AfterSaleUpdate {
  const audit = String(data?.auditStatus ?? '');
  const refund = String(data?.refundStatus ?? '');
  const auditOpinion = data?.auditOpinion?.trim() || null;
  const refundOpinion = data?.refundOpinion?.trim() || null;
  if (refund === '1') return { status: 'refunded', opinion: refundOpinion };
  if (refund === '2') {
    return { status: 'refund_failed', opinion: refundOpinion ?? auditOpinion };
  }
  if (audit === '1') return { status: 'withdrawn', opinion: auditOpinion };
  if (audit === '3') return { status: 'rejected', opinion: auditOpinion };
  if (audit === '2') return { status: 'approved', opinion: auditOpinion };
  return { status: 'pending', opinion: auditOpinion };
}

/** The order note telling the admin what Billion did with a request. */
export function afterSaleNote(
  afterSaleId: string,
  iccids: string,
  update: AfterSaleUpdate,
): string {
  const ref = `yêu cầu hoàn tiền #${afterSaleId} (ICCID ${iccids})`;
  const said = update.opinion ? `: "${update.opinion}"` : '';
  switch (update.status) {
    case 'approved':
      return `Billion đã duyệt ${ref}${said} — chờ Billion hoàn tiền.`;
    case 'rejected':
      return `Billion TỪ CHỐI ${ref}${said} — cần liên hệ Billion để lấy lại tiền.`;
    case 'withdrawn':
      return `Billion ghi ${ref} là đã rút lại${said}.`;
    case 'refunded':
      return `Billion đã hoàn tiền xong cho yêu cầu #${afterSaleId} (ICCID ${iccids})${said}.`;
    case 'refund_failed':
      return `Billion hoàn tiền THẤT BẠI cho ${ref}${said} — cần liên hệ Billion.`;
    default:
      return `Billion đang xem ${ref}${said}.`;
  }
}

/** How the after-sale reason reads for the admin. */
export function afterSaleReasonLabel(reason: string): string {
  return reason === '29' ? 'eSIM chưa tải về' : 'hoàn không lý do';
}
