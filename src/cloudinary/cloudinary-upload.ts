import crypto from 'crypto';

/**
 * Uploading to Cloudinary without a public preset (security 15/11/2026).
 *
 * Every site used to upload straight to Cloudinary with an unsigned preset
 * whose name ships in the public JavaScript, so anyone could store anything in
 * our account. Now a page asks this API for a signed ticket (one folder, valid
 * for an hour) and uploads with it. Once CLOUDINARY_API_SECRET is set and the
 * old preset is switched to "Signed" in Cloudinary, the public way is closed.
 *
 * Until the secret is set, the ticket carries the preset from the server's env
 * instead, so uploads keep working through the change-over.
 */
export type CloudinaryPurpose = 'cms' | 'chat' | 'ticket';

export const CLOUDINARY_FOLDERS: Record<CloudinaryPurpose, string> = {
  cms: 'cms',
  chat: 'chat',
  ticket: 'tickets',
};

export type CloudinaryUploadTicket =
  | {
      mode: 'signed';
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
    }
  | { mode: 'unsigned'; cloudName: string; uploadPreset: string };

/**
 * Cloudinary's request signature: the parameters sorted by name, joined as
 * `k=v&k=v`, the API secret appended, SHA-1 in hex.
 * https://cloudinary.com/documentation/authentication_signatures
 */
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .filter((key) => params[key] !== '' && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto
    .createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
}

export function cloudinaryUploadTicket(
  purpose: CloudinaryPurpose,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): CloudinaryUploadTicket | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;

  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (apiKey && apiSecret) {
    const timestamp = Math.floor(now.getTime() / 1000);
    const folder = CLOUDINARY_FOLDERS[purpose];
    return {
      mode: 'signed',
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature: signCloudinaryParams({ folder, timestamp }, apiSecret),
    };
  }

  const uploadPreset = env.CLOUDINARY_UPLOAD_PRESET;
  if (!uploadPreset) return null;
  return { mode: 'unsigned', cloudName, uploadPreset };
}

/** The form fields that go next to `file` for a ticket. */
export function cloudinaryFormFields(
  ticket: CloudinaryUploadTicket,
): Record<string, string> {
  return ticket.mode === 'signed'
    ? {
        api_key: ticket.apiKey,
        timestamp: String(ticket.timestamp),
        signature: ticket.signature,
        folder: ticket.folder,
      }
    : { upload_preset: ticket.uploadPreset };
}
