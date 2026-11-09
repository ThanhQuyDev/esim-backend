import { HttpException, ServiceUnavailableException } from '@nestjs/common';

/**
 * What a partner may read of an error (doitac-0911 #006).
 *
 * A distribution partner resells our eSIMs, so the supplier behind them is a
 * trade secret. "Topup hộ khách" passed supplier failures straight through:
 * the supplier's name, its error code and its own message reached the portal.
 * Our own refusals (balance too low, wallet locked, no price yet) are written
 * for the partner in Vietnamese and pass as they are; anything else — a
 * server error, a supplier's answer, a network failure — becomes `fallback`.
 */
const SUPPLIER_TRACE =
  /airalo|esim\s*-?\s*access|gadget|billion|micro\s*-?\s*esim|cmlink|\bF0\d{2}\b|status code|request failed|econn|etimedout|socket|axios|supplier|provider|package\s*(code|id)|https?:\/\/|\bapi\b/i;

export function isPartnerSafeMessage(message: string): boolean {
  return !!message.trim() && !SUPPLIER_TRACE.test(message);
}

function messageOf(err: HttpException): string {
  const body = err.getResponse();
  if (typeof body === 'string') return body;
  const message = (body as { message?: unknown })?.message;
  return Array.isArray(message) ? message.join(' ') : String(message ?? '');
}

export function toPartnerSafeError(err: unknown, fallback: string): Error {
  if (
    err instanceof HttpException &&
    err.getStatus() < 500 &&
    isPartnerSafeMessage(messageOf(err))
  ) {
    return err;
  }
  return new ServiceUnavailableException(fallback);
}

export const TOPUP_LIST_UNAVAILABLE =
  'Hệ thống đang bị gián đoạn nên chưa lấy được danh sách gói topup/add-on cho eSIM này. Nếu bạn cần topup/add-on gấp, vui lòng liên hệ bộ phận hỗ trợ esim.vn.';

export const TOPUP_UNAVAILABLE =
  'Hệ thống đang bị gián đoạn nên chưa hoàn tất topup/add-on cho eSIM này. Nếu bạn cần gấp, vui lòng liên hệ bộ phận hỗ trợ esim.vn. Nếu ví đã bị trừ tiền, esim.vn sẽ xử lý tiếp hoặc hoàn lại cho bạn.';

export const RETRY_UNAVAILABLE =
  'Hệ thống đang bị gián đoạn nên chưa gọi lại được. Hệ thống vẫn tự gọi lại sau ít phút; nếu vẫn còn lỗi vui lòng liên hệ Admin để được hỗ trợ.';
