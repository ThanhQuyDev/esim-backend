/**
 * Pacing of the supplier calls of one order or upload (vande-1411 #003).
 *
 * Anh Thọ saw that eSIMs fail when many are asked for in the same instant, so
 * a bulk order, a several-kind "đặt đơn hộ" and a partner's bulk upload now
 * ask for each eSIM on its own, a random 10–30 seconds after the one before
 * (5–10 for a file, which mails nothing), and mail it as soon as it comes.
 */

export type PacingRange = { minSec: number; maxSec: number };

/** "Gửi email": the gap between two eSIMs, which is also the gap between two emails. */
export const PACING_EMAIL_DEFAULT: PacingRange = { minSec: 10, maxSec: 30 };
/** "Xuất file": nothing is mailed, the calls only need spreading. */
export const PACING_FILE_DEFAULT: PacingRange = { minSec: 5, maxSec: 10 };
/** Above this a single gap makes no sense. */
export const PACING_MAX_SEC = 600;

/**
 * The range the admin typed, made sane: missing values take the default, the
 * two ends are put in order and kept within 0–{@link PACING_MAX_SEC}.
 */
export function pacingRange(
  input: { minSec?: number | null; maxSec?: number | null } | null | undefined,
  fallback: PacingRange,
): PacingRange {
  const clamp = (v: number) =>
    Math.min(PACING_MAX_SEC, Math.max(0, Math.round(v)));
  const min =
    input?.minSec == null || !Number.isFinite(Number(input.minSec))
      ? null
      : clamp(Number(input.minSec));
  const max =
    input?.maxSec == null || !Number.isFinite(Number(input.maxSec))
      ? null
      : clamp(Number(input.maxSec));
  if (min == null && max == null) return { ...fallback };
  const a = min ?? max!;
  const b = max ?? min!;
  return { minSec: Math.min(a, b), maxSec: Math.max(a, b) };
}

/** One random gap of the range, in milliseconds. */
export function pacingGapMs(
  range: PacingRange,
  random: () => number = Math.random,
): number {
  return Math.round(
    (range.minSec + random() * (range.maxSec - range.minSec)) * 1000,
  );
}

/**
 * The moment of each of `count` calls: the first at `start`, each next one a
 * random gap after the one before.
 */
export function pacingSchedule(
  count: number,
  range: PacingRange,
  start: Date,
  random: () => number = Math.random,
): Date[] {
  const times: Date[] = [];
  let at = start.getTime();
  for (let i = 0; i < count; i++) {
    if (i > 0) at += pacingGapMs(range, random);
    times.push(new Date(at));
  }
  return times;
}

/**
 * How long the calls take at most, for "dự kiến lấy xong eSIM": the longest
 * gap times the gaps between `count` eSIMs.
 */
export function pacingMaxDurationSec(
  count: number,
  range: PacingRange,
): number {
  return Math.max(0, count - 1) * range.maxSec;
}
