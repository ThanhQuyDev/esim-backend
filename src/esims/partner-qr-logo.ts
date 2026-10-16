import { DataSource } from 'typeorm';
import { isOwnFileUrl, readPartnerBrand } from '../partners/partner-brand';

/**
 * The logo in the middle of the QR code of an eSIM a distribution partner
 * bought: theirs, from "Cấu hình thương hiệu", instead of esim.vn's
 * (doitac-1410 #044). Null means "use the esim.vn logo".
 *
 * Only a file our own upload stored is downloaded (see `isOwnFileUrl`), with
 * a short timeout and a size cap — this runs on an unauthenticated image
 * endpoint, so a slow or huge file must not hold it up.
 */

const FETCH_TIMEOUT_MS = 3000;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map<string, { buffer: Buffer; at: number }>();

/** Test seam. */
export function resetPartnerLogoCache(): void {
  cache.clear();
}

export async function loadPartnerQrLogo(
  dataSource: DataSource | undefined,
  esimId: number,
  opts: { backendDomain?: string; s3Bucket?: string; s3Region?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer | null> {
  if (!dataSource) return null;
  try {
    const [row] = await dataSource.query(
      `SELECT pa."brandInfo"
         FROM esim e
         JOIN order_item oi ON oi.id = e."orderItemId"
         JOIN "order" o ON o.id = oi."orderId"
         JOIN partner pa ON pa."userId" = o."userId"
                        AND pa."partnerType" = 'distribution'
                        AND pa."deletedAt" IS NULL
        WHERE e.id = $1
        LIMIT 1`,
      [esimId],
    );
    const logoUrl = row?.brandInfo
      ? readPartnerBrand(row.brandInfo).logoUrl
      : '';
    if (!logoUrl || !isOwnFileUrl(logoUrl, opts)) return null;

    const hit = cache.get(logoUrl);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.buffer;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetchImpl(logoUrl, { signal: controller.signal });
      const type = res.headers.get('content-type') ?? '';
      const length = Number(res.headers.get('content-length') ?? 0);
      if (!res.ok || !type.startsWith('image/') || length > MAX_LOGO_BYTES) {
        return null;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length || buffer.length > MAX_LOGO_BYTES) return null;
      cache.set(logoUrl, { buffer, at: Date.now() });
      return buffer;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
