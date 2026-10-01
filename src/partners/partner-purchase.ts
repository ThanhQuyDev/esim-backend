import { PartnerStatusEnum, PartnerTypeEnum } from './partners.enum';

/**
 * Đối tác phân phối mua hàng bằng ví ký quỹ (#046).
 *
 * Quyết định nghiệp vụ đã chốt 02/10/2026:
 *
 * - Mua được **mọi gói** đang bán, không có danh sách riêng cho đối tác.
 * - **Không giới hạn số lượng** — đủ tiền trong ví là mua được.
 * - Giao hàng bằng **một file Excel tải về**, không gửi email từng eSIM.
 * - eSIM lỗi: đối tác báo, **admin duyệt tay** mới hoàn tiền vào ví.
 * - Đối tác **tự huỷ được** đơn của mình (khi chưa cấp eSIM).
 * - Cột "Doanh thu bán ra" lấy **giá niêm yết esim.vn**, không có ô cho đối
 *   tác tự nhập giá bán của họ.
 *
 * File này cố ý không đụng tới database: toàn bộ công thức tiền nong nằm ở đây
 * để test được bằng số, còn service chỉ lo lưu và gọi nhà cung cấp.
 */

/** Giá một eSIM bán cho đối tác = giá vốn + markup theo hạng. */
export function partnerPurchaseUnitPriceVnd(
  costVnd: number,
  costMarkupPercent: number,
): number {
  const cost = Math.max(0, Number(costVnd) || 0);
  const markup = Math.max(0, Number(costMarkupPercent) || 0);
  return Math.round(cost * (1 + markup / 100));
}

export type PartnerPurchaseQuoteInput = {
  /** `plan.vndCostPrice` — giá vốn esim.vn trả nhà cung cấp. */
  unitCostVnd: number;
  /** `tier.costMarkupPercent` của hạng đối tác đang giữ. */
  costMarkupPercent: number;
  /** `plan.vndPrice` — giá niêm yết trên esim.vn (quyết định B, phương án a). */
  listPriceVnd: number;
  quantity: number;
};

export type PartnerPurchaseQuote = {
  quantity: number;
  /** Giá vốn đối tác phải trả cho MỘT eSIM. */
  unitPriceVnd: number;
  /** Tổng tiền trừ khỏi ví. */
  totalVnd: number;
  /** Giá niêm yết một eSIM. */
  listUnitPriceVnd: number;
  /** Doanh thu bán ra nếu bán hết theo giá niêm yết. */
  listTotalVnd: number;
  /** Chênh lệch = doanh thu bán ra − giá vốn đã trừ ví. */
  marginVnd: number;
  /**
   * Chênh lệch trên doanh thu, %.
   *
   * Mẫu số là doanh thu bán ra chứ không phải giá vốn: đây là con số đối tác
   * đọc trên màn hình "Doanh thu và đơn hàng", và nó phải cùng cách tính với
   * biên lợi nhuận ở mọi chỗ khác. Doanh thu 0 thì trả 0 thay vì vô cực.
   */
  marginPercent: number;
};

/**
 * Báo giá một lần mua.
 *
 * `marginVnd` có thể âm — khi markup của hạng đẩy giá vốn vượt giá niêm yết.
 * Không chặn ở đây: đó là một thoả thuận kinh doanh hợp lệ (đối tác bán theo
 * giá của họ, không buộc bán đúng giá niêm yết), nhưng màn hình phải hiện đúng
 * số âm đó thay vì kẹp về 0 và làm đối tác tưởng mình hoà vốn.
 */
export function partnerPurchaseQuote(
  input: PartnerPurchaseQuoteInput,
): PartnerPurchaseQuote {
  const quantity = Math.max(0, Math.trunc(Number(input.quantity) || 0));
  const unitPriceVnd = partnerPurchaseUnitPriceVnd(
    input.unitCostVnd,
    input.costMarkupPercent,
  );
  const listUnitPriceVnd = Math.max(
    0,
    Math.round(Number(input.listPriceVnd) || 0),
  );

  const totalVnd = unitPriceVnd * quantity;
  const listTotalVnd = listUnitPriceVnd * quantity;
  const marginVnd = listTotalVnd - totalVnd;

  return {
    quantity,
    unitPriceVnd,
    totalVnd,
    listUnitPriceVnd,
    listTotalVnd,
    marginVnd,
    marginPercent:
      listTotalVnd > 0
        ? Math.round((marginVnd / listTotalVnd) * 10000) / 100
        : 0,
  };
}

export type PartnerPurchaseEligibility = {
  partnerType: PartnerTypeEnum;
  partnerStatus: PartnerStatusEnum;
  walletLocked: boolean;
  balanceVnd: number;
};

/**
 * Lý do một lần mua bị từ chối, hoặc null khi mua được.
 *
 * Trả về câu tiếng Việt vì nó hiện thẳng cho đối tác. Thứ tự kiểm tra đi từ
 * "không bao giờ mua được" tới "lần này chưa mua được", để đối tác nhận đúng
 * lý do gốc chứ không phải "không đủ số dư" khi vấn đề thật là tài khoản đang
 * bị khoá.
 */
export function partnerPurchaseRejection(
  eligibility: PartnerPurchaseEligibility,
  quote: PartnerPurchaseQuote,
): string | null {
  if (eligibility.partnerType === PartnerTypeEnum.KOL) {
    return 'Đối tác tiếp thị không mua hàng bằng ví ký quỹ. Thu nhập của bạn là hoa hồng.';
  }
  if (eligibility.partnerStatus !== PartnerStatusEnum.ACTIVE) {
    return 'Tài khoản đối tác của bạn chưa được kích hoạt nên chưa đặt mua được.';
  }
  if (eligibility.walletLocked) {
    return 'Ví ký quỹ đang bị khoá. Liên hệ esim.vn để mở lại.';
  }
  if (quote.quantity < 1) {
    return 'Số lượng phải từ 1 trở lên.';
  }
  if (quote.unitPriceVnd <= 0) {
    // Giá vốn 0 nghĩa là gói chưa được job tỷ giá điền giá, không phải hàng
    // miễn phí. Bán ở mức đó là tặng không hàng loạt.
    return 'Gói này chưa có giá vốn nên tạm thời chưa đặt mua được. Liên hệ esim.vn.';
  }
  if (quote.totalVnd > eligibility.balanceVnd) {
    const thieu = quote.totalVnd - eligibility.balanceVnd;
    return `Số dư ví không đủ: cần ${quote.totalVnd.toLocaleString('vi-VN')}đ, còn thiếu ${thieu.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm.`;
  }
  return null;
}
