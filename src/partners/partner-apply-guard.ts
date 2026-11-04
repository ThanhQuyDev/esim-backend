import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { PartnerApplyDto } from './dto/partner-apply.dto';
import { SlidingWindowLimiter } from '../tickets/ticket-spam-guard';

/**
 * Server-side guard for the public partner application (vande-0411 #006).
 *
 * The form's required fields only ran in the browser, so a script posting to
 * `POST /api/v1/partners/apply` filed applications with no main channel from
 * throwaway addresses: 5 in one day on 03/11. These rules hold whatever the
 * client does, and none of them can catch an applicant using the real form.
 */

/** Applications from one address per hour. */
export const APPLY_IP_LIMIT = 5;
/** Applications from everyone per hour: real ones number a few a week. */
export const APPLY_TOTAL_LIMIT = 30;
export const APPLY_WINDOW_MS = 60 * 60 * 1000;

export function applyLimiters() {
  return {
    byIp: new SlidingWindowLimiter(APPLY_IP_LIMIT, APPLY_WINDOW_MS),
    total: new SlidingWindowLimiter(APPLY_TOTAL_LIMIT, APPLY_WINDOW_MS),
  };
}

/** Addresses that exist to be thrown away, or never belonged to anybody. */
const THROWAWAY_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  'dispostable.com',
  'example.com',
  'example.net',
  'example.org',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'mailinator.com',
  'maildrop.cc',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'test.com',
  'trashmail.com',
  'yopmail.com',
]);

export function isThrowawayEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return THROWAWAY_EMAIL_DOMAINS.has(domain);
}

/** 9 to 15 digits, with the separators people type. */
export function isPlausiblePhone(phone: string): boolean {
  const text = phone.trim();
  if (!/^\+?[\d\s().-]+$/.test(text)) return false;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function hasMainChannel(info: PartnerApplyDto['channelInfo']): boolean {
  const channel = info?.channel;
  return typeof channel === 'string' && channel.trim().length > 0;
}

const refuse = (field: string, code: string, message: string) =>
  new UnprocessableEntityException({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    errors: { [field]: code },
    message,
  });

/** What the form asks for, checked again here. */
export function assertApplicationComplete(dto: PartnerApplyDto): void {
  // Filled by a script only: the field is hidden from people.
  if (dto.website?.trim()) {
    throw refuse(
      'application',
      'spamDetected',
      'Không gửi được hồ sơ. Vui lòng tải lại trang và thử lại.',
    );
  }
  if (!dto.contactName?.trim()) {
    throw refuse(
      'contactName',
      'contactNameRequired',
      'Vui lòng nhập họ và tên người liên hệ.',
    );
  }
  if (!isPlausiblePhone(dto.contactPhone ?? '')) {
    throw refuse(
      'contactPhone',
      'contactPhoneInvalid',
      'Số điện thoại không hợp lệ.',
    );
  }
  if (isThrowawayEmail(dto.contactEmail ?? '')) {
    throw refuse(
      'contactEmail',
      'emailNotAccepted',
      'Vui lòng dùng địa chỉ email thật để nhận kết quả xét duyệt.',
    );
  }
  if (!hasMainChannel(dto.channelInfo)) {
    throw refuse('channel', 'channelRequired', 'Vui lòng chọn kênh chính.');
  }
  if (dto.legalType === 'company') {
    if (!dto.companyName?.trim()) {
      throw refuse(
        'companyName',
        'companyNameRequired',
        'Vui lòng nhập tên công ty.',
      );
    }
    if (!dto.taxCode?.trim()) {
      throw refuse('taxCode', 'taxCodeRequired', 'Vui lòng nhập mã số thuế.');
    }
  }
}

/** Whether this address identifies a visitor rather than our own proxy. */
export function isVisitorAddress(ip: string | undefined): ip is string {
  return (
    !!ip && !['unknown', '127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)
  );
}

export function tooManyApplications(): UnprocessableEntityException {
  return refuse(
    'application',
    'tooManyApplications',
    'Có quá nhiều hồ sơ được gửi trong thời gian ngắn. Vui lòng thử lại sau.',
  );
}
