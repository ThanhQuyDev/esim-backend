import { createHash } from 'crypto';

/**
 * A stable, non-reversible id for a network address (#036).
 *
 * Two affiliate orders from the same household should be comparable without
 * the address itself being stored — this is a fraud-watch signal, not a
 * location record.
 */
export function hashIpForFraudWatch(ip?: string | null): string | null {
  const value = ip?.trim();
  if (!value || value === 'unknown') return null;

  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
