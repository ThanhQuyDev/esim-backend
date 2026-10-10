import { Logger } from '@nestjs/common';

/** One file carried by a customer's email reply. */
export type EmailAttachment = {
  filename?: string | null;
  contentType?: string | null;
  size?: number | null;
  content: Buffer;
  /** Inline images that are only a signature logo are skipped. */
  related?: boolean;
};

/** At most this many files per email, each at most 10 MB. */
export const MAX_EMAIL_ATTACHMENTS = 5;
export const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Images and documents a support conversation plausibly needs. */
const ALLOWED_TYPES =
  /^(image\/(png|jpe?g|gif|webp|heic|heif)|application\/pdf|video\/(mp4|quicktime))$/i;

/** The files worth filing: allowed types, sane sizes, signature logos dropped. */
export function pickEmailAttachments(
  attachments: EmailAttachment[] | null | undefined,
): EmailAttachment[] {
  return (attachments ?? [])
    .filter((file) => !file.related)
    .filter((file) => ALLOWED_TYPES.test(file.contentType ?? ''))
    .filter((file) => {
      const size = file.size ?? file.content?.length ?? 0;
      return size > 0 && size <= MAX_EMAIL_ATTACHMENT_BYTES;
    })
    .slice(0, MAX_EMAIL_ATTACHMENTS);
}

/**
 * Upload a customer's email attachment to the same Cloudinary account the site
 * uses (#041, test round 4), so it shows in the CMS thread like a file sent
 * through the support form.
 *
 * Uses the unsigned upload preset the storefront already uploads with — the
 * cloud name and preset are public values, not credentials. Returns null when
 * they are not configured or the upload fails; the caller then names the file
 * in the message instead, so nothing is silently lost.
 */
export async function uploadEmailAttachment(
  file: EmailAttachment,
  env: { cloudName?: string; uploadPreset?: string },
  logger?: Logger,
): Promise<string | null> {
  if (!env.cloudName || !env.uploadPreset) return null;
  try {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.content)], {
        type: file.contentType ?? 'application/octet-stream',
      }),
      file.filename ?? 'attachment',
    );
    form.append('upload_preset', env.uploadPreset);
    form.append('folder', 'tickets');
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${env.cloudName}/auto/upload`,
      { method: 'POST', body: form },
    );
    if (!res.ok) {
      logger?.warn(
        `Attachment ${file.filename ?? ''} upload failed: HTTP ${res.status}`,
      );
      return null;
    }
    const json = (await res.json()) as { secure_url?: string };
    return json.secure_url ?? null;
  } catch (err) {
    logger?.warn(
      `Attachment ${file.filename ?? ''} upload failed: ${(err as Error).message}`,
    );
    return null;
  }
}
