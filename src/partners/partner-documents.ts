import { createHmac, timingSafeEqual } from 'crypto';
import { extname } from 'path';

/**
 * Documents attached to a partner application (doitac-1410 #013).
 *
 * The applicant has no account yet, so the upload cannot ride on a session.
 * Applying returns a short-lived token for that one application, and only that
 * token opens the upload — a stranger cannot attach files to somebody else's
 * application, and the token is worthless an hour later.
 *
 * The files are ID cards and business licences, so they are kept outside the
 * public uploads folder and only an admin route reads them back.
 */

export const PARTNER_DOCUMENTS_DIR = './private/partner-documents';
export const PARTNER_DOCUMENT_MAX_FILES = 5;
export const PARTNER_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** What an applicant may attach, by extension and the type the browser sent. */
const ALLOWED: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
};

export function isAllowedPartnerDocument(file: {
  originalname: string;
  mimetype: string;
  size: number;
}): string | null {
  const ext = extname(file.originalname).toLowerCase();
  if (!ALLOWED[ext]?.includes(file.mimetype)) {
    return `File "${file.originalname}" không đúng định dạng. Chỉ nhận PDF, JPG, PNG, WEBP.`;
  }
  if (file.size > PARTNER_DOCUMENT_MAX_BYTES) {
    return `File "${file.originalname}" lớn hơn 5MB.`;
  }
  return null;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** A token that lets this one application attach its documents for an hour. */
export function documentUploadToken(
  partnerId: number,
  secret: string,
  now = Date.now(),
): string {
  const payload = `${partnerId}.${now + TOKEN_TTL_MS}`;
  return `${payload}.${sign(`partner-docs:${payload}`, secret)}`;
}

/** The partner id the token was issued for, or null if it is forged or old. */
export function verifyDocumentUploadToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): number | null {
  const parts = (token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [id, expires, signature] = parts;
  const expected = sign(`partner-docs:${id}.${expires}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!(Number(expires) > now)) return null;
  const partnerId = Number(id);
  return Number.isInteger(partnerId) && partnerId > 0 ? partnerId : null;
}
