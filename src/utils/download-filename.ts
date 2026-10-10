/**
 * Download file names stamped with the moment they were taken, in Vietnam time
 * (#055, test round 4): `Danh-sach-link-tiep-thi_06-10-2026_00-41-52.xlsx`.
 *
 * Exports used to carry `Date.now()` — `link-tiep-thi-1791588400985.xlsx` — which
 * says nothing to the person who later looks for "the file from Monday night".
 */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `dd-MM-yyyy_HH-mm-ss` in Vietnam time. */
export function downloadStamp(at: Date = new Date()): string {
  const local = new Date(at.getTime() + VIETNAM_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(local.getUTCDate())}-${pad(local.getUTCMonth() + 1)}-${local.getUTCFullYear()}` +
    `_${pad(local.getUTCHours())}-${pad(local.getUTCMinutes())}-${pad(local.getUTCSeconds())}`
  );
}

/** `<base>_<dd-MM-yyyy_HH-mm-ss>.<ext>`. */
export function downloadFilename(
  base: string,
  ext = 'xlsx',
  at: Date = new Date(),
): string {
  return `${base}_${downloadStamp(at)}.${ext}`;
}
