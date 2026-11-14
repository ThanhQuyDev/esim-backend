/**
 * Which web pages may call this API from a browser (security 15/11/2026).
 *
 * It used to be `cors: true` (every site). Now it is our own domains — esim.vn
 * and its subdomains (admin, doitac, beta…), the other esim domains, the
 * Vercel test sites — plus anything listed in CORS_ORIGINS. Calls that carry
 * no Origin (servers, supplier webhooks, the partner API, Next server
 * rendering, mobile apps) are not browser cross-site calls and stay allowed.
 */
const OWN_DOMAINS =
  /^https?:\/\/([a-z0-9-]+\.)*(esim\.vn|esim\.com\.vn|travelesim\.vn|travelesim\.net|esimtravel\.net|esimvietnam\.com)$/i;

const VERCEL_SITES =
  /^https:\/\/(esim-frontend-theta|esim-admin-eta|esim-doitac|[a-z0-9-]+-truong-thanh-quys-projects)\.vercel\.app$/i;

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function isAllowedOrigin(
  origin: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!origin) return true;
  if (OWN_DOMAINS.test(origin) || VERCEL_SITES.test(origin)) return true;
  if (
    LOCALHOST.test(origin) &&
    (env.NODE_ENV !== 'production' || env.CORS_ALLOW_LOCALHOST === 'true')
  ) {
    return true;
  }
  const extra = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
  return extra.includes(origin.toLowerCase());
}

/** For `cors` (express) and socket.io: allow, or answer without CORS headers. */
export function corsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  callback(null, isAllowedOrigin(origin));
}
