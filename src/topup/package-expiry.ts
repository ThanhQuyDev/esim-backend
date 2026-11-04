/**
 * What each package in the "buy more" list does to the eSIM's date (vande-0411
 * #021): a top-up follows what is left, as the top-up itself will do once it
 * goes through, and an add-on leaves the date alone.
 */
const DAY_MS = 86_400_000;

export function withExpiryAfter<
  P extends { kind?: string; durationDays?: number | null },
>(
  packages: P[],
  context: { current: Date | null; billionFixed: boolean; now?: Date },
): (P & { expiresAfter: string | null; startsAfterCurrent: boolean })[] {
  const now = (context.now ?? new Date()).getTime();
  const current = context.current?.getTime() ?? null;
  return packages.map((pkg) => {
    if (pkg.kind === 'addon') {
      return {
        ...pkg,
        expiresAfter: current === null ? null : new Date(current).toISOString(),
        startsAfterCurrent: false,
      };
    }
    const days = Number(pkg.durationDays) || 0;
    return {
      ...pkg,
      // Not switched on yet: the clock has not started, so no date to promise.
      expiresAfter:
        current === null || days <= 0
          ? null
          : new Date(Math.max(current, now) + days * DAY_MS).toISOString(),
      startsAfterCurrent: context.billionFixed,
    };
  });
}
