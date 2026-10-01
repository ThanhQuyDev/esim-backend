import { ApnSupportRow } from './infrastructure/persistence/apn-support.repository';
import { DevicePlatform, TrackedApp, normalizeApn } from './apn-support.types';

/**
 * Reading the APN sheet (#065).
 *
 * The real sheet ("APN Tiktok-GPT", received 02/10/2026) is one row per APN and
 * device, with one column per app:
 *
 *   APN | Thiết bị | TikTok | ChatGPT | Gemini | Claude
 *   cmhk | Android | Không hỗ trợ | Hỗ trợ | Hỗ trợ | Không hỗ trợ
 *   cmhk | iPhone  | Hỗ trợ       | Hỗ trợ | Hỗ trợ | Không hỗ trợ
 *
 * The wide shape — one row per APN with "TikTok iPhone" / "TikTok Android"
 * columns — is also accepted, because that is how the layout was described before
 * the file arrived and a later sheet may well be written that way.
 *
 * Columns are found by their HEADER TEXT rather than by position, because the
 * sheet is maintained by hand: a column inserted in front of another would
 * otherwise silently shift every answer one across, and marking a plan
 * TikTok-capable when it is not is the one outcome worth engineering against.
 */

/** Header wording accepted for each app column, lower-cased, spaces stripped. */
const APP_PATTERNS: Record<TrackedApp, RegExp> = {
  tiktok: /tiktok/,
  chatGpt: /chat_?gpt|^gpt$/,
  gemini: /gemini/,
  claude: /claude/,
};

/** Device wording in the "Thiết bị" column. */
const DEVICE_PATTERNS: [DevicePlatform, RegExp][] = [
  ['ios', /ios|iphone|ipad|apple/],
  ['android', /android/],
];

/** Which platform a wide-layout header names, if any. */
const PLATFORM_IN_HEADER: [DevicePlatform, RegExp][] = [
  ['ios', /ios|iphone|apple/],
  ['android', /android/],
];

export type ApnSheetColumns = {
  apn: number;
  /** Present only in the long layout. */
  device?: number;
  note?: number;
  /**
   * Which column holds which app, and for the wide layout which device too.
   * `device: null` means the column covers every device.
   */
  apps: { app: TrackedApp; device: DevicePlatform | null; column: number }[];
};

export type ApnSheetResult = {
  rows: ApnSupportRow[];
  errors: Array<{ row: number; error: string }>;
  /** APN+device pairs that appeared twice; the first one wins. */
  duplicates: string[];
};

/**
 * Chữ trong một ô, dù exceljs trả về kiểu gì.
 *
 * Ô có định dạng (tô màu, in đậm một phần) không trả về chuỗi mà trả về
 * `{ richText: [...] }`; ô công thức trả về `{ result }`; ô có link trả về
 * `{ text, hyperlink }`. `String(value)` với mấy kiểu đó ra "[object Object]" —
 * trong file thật có 13 ô APN như vậy, và chúng gộp hết vào một dòng rác.
 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();

  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.richText)) {
    return (obj.richText as { text?: string }[])
      .map((part) => part?.text ?? '')
      .join('');
  }
  if ('result' in obj) return cellText(obj.result);
  if (typeof obj.text === 'string') return obj.text;
  return '';
}

function normalizeHeader(value: unknown): string {
  return cellText(value)
    .toLowerCase()
    .replace(/[\s\-._()]/g, '');
}

/**
 * Locate the columns from a header row. Returns null when there is no APN column
 * or no app column at all, so the upload is refused rather than importing a sheet
 * we have misread.
 */
export function findApnSheetColumns(
  headerCells: unknown[],
): ApnSheetColumns | null {
  let apn: number | undefined;
  let device: number | undefined;
  let note: number | undefined;
  const apps: ApnSheetColumns['apps'] = [];

  headerCells.forEach((cell, index) => {
    const header = normalizeHeader(cell);
    if (!header) return;
    const column = index + 1; // exceljs columns are 1-based

    if (apn === undefined && /^apn$/.test(header)) {
      apn = column;
      return;
    }
    if (
      device === undefined &&
      /^(thietbi|thiếtbị|device|os|platform)$/.test(header)
    ) {
      device = column;
      return;
    }
    if (note === undefined && /^(note|notes|ghichu|ghichú)$/.test(header)) {
      note = column;
      return;
    }

    for (const [app, pattern] of Object.entries(APP_PATTERNS) as [
      TrackedApp,
      RegExp,
    ][]) {
      if (!pattern.test(header)) continue;
      // In the wide layout the platform is part of the header itself.
      const platform =
        PLATFORM_IN_HEADER.find(([, re]) => re.test(header))?.[0] ?? null;
      apps.push({ app, device: platform, column });
      return;
    }
  });

  if (apn === undefined || apps.length === 0) return null;

  return { apn, device, note, apps };
}

/** Wording that counts as yes. Anything else — including blank — is no. */
const YES = new Set([
  'hỗ trợ',
  'ho tro',
  'co',
  'có',
  'yes',
  'y',
  'true',
  '1',
  'x',
  'ok',
  'support',
  'supported',
]);

/**
 * A yes/no cell.
 *
 * Unrecognised wording reads as NO on purpose: the alternative is telling a
 * customer an eSIM works with TikTok because a cell said something we did not
 * understand. Note "không hỗ trợ" is not in the set and so reads as no — the
 * comparison is on the whole cell, never a substring, or it would match "hỗ trợ"
 * inside it and invert the answer.
 */
export function parseYesNo(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = cellText(value).trim().toLowerCase();
  return YES.has(text);
}

/** Which platform a "Thiết bị" cell names, or null when it says neither. */
export function parseDevice(value: unknown): DevicePlatform | null {
  const text = cellText(value)
    .trim()
    .toLowerCase()
    .replace(/[\s\-._]/g, '');
  if (!text) return null;
  return DEVICE_PATTERNS.find(([, re]) => re.test(text))?.[0] ?? null;
}

const EMPTY_ROW = (apn: string, apnLabel: string): ApnSupportRow => ({
  apn,
  apnLabel,
  tiktokIos: false,
  tiktokAndroid: false,
  chatGptIos: false,
  chatGptAndroid: false,
  geminiIos: false,
  geminiAndroid: false,
  claudeIos: false,
  claudeAndroid: false,
  note: null,
});

/** `tiktok` + `ios` -> `tiktokIos`, the column name on the row. */
function field(app: TrackedApp, device: DevicePlatform): keyof ApnSupportRow {
  const suffix = device === 'ios' ? 'Ios' : 'Android';
  return `${app}${suffix}` as keyof ApnSupportRow;
}

/**
 * Turn the sheet's data rows into table rows, one per APN.
 *
 * In the long layout an APN spans two rows (one per device) and they are merged
 * into one record. `cellAt(row, column)` reads one cell, so this stays free of
 * exceljs and can be tested on plain arrays.
 */
export function readApnSheetRows(
  columns: ApnSheetColumns,
  rowNumbers: number[],
  cellAt: (row: number, column: number) => unknown,
): ApnSheetResult {
  const byApn = new Map<string, ApnSupportRow>();
  const errors: ApnSheetResult['errors'] = [];
  const duplicates: string[] = [];
  const seenPairs = new Set<string>();

  for (const rowNumber of rowNumbers) {
    const label = cellText(cellAt(rowNumber, columns.apn)).trim();
    const apn = normalizeApn(label);

    // A blank APN is an empty row, not an error — sheets are full of them.
    if (!apn) continue;

    const rowDevice =
      columns.device === undefined
        ? null
        : parseDevice(cellAt(rowNumber, columns.device));

    if (columns.device !== undefined && !rowDevice) {
      errors.push({
        row: rowNumber,
        error: `APN "${label}": cột Thiết bị không đọc được (chỉ nhận iPhone hoặc Android)`,
      });
      continue;
    }

    const pairKey = `${apn}|${rowDevice ?? 'all'}`;
    if (seenPairs.has(pairKey)) {
      duplicates.push(rowDevice ? `${label} (${rowDevice})` : label);
      continue;
    }
    seenPairs.add(pairKey);

    const record = byApn.get(apn) ?? EMPTY_ROW(apn, label);

    for (const { app, device, column } of columns.apps) {
      const value = parseYesNo(cellAt(rowNumber, column));
      // Wide layout: the header names the device. Long layout: the row does.
      const targets: DevicePlatform[] = device
        ? [device]
        : rowDevice
          ? [rowDevice]
          : ['ios', 'android'];
      for (const target of targets) {
        (record as Record<string, unknown>)[field(app, target)] = value;
      }
    }

    if (columns.note !== undefined) {
      const note = cellText(cellAt(rowNumber, columns.note)).trim();
      if (note) record.note = note;
    }

    byApn.set(apn, record);
  }

  return { rows: [...byApn.values()], errors, duplicates };
}
