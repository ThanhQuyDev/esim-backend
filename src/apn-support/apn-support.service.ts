import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Workbook } from 'exceljs';
import {
  ApnSupportFilters,
  ApnSupportRepository,
  ApnSupportRow,
} from './infrastructure/persistence/apn-support.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { ApnSupport } from './domain/apn-support';
import {
  ApnCapabilities,
  emptyCapabilities,
  normalizeApn,
  worksOnEveryDevice,
} from './apn-support.types';
import { findApnSheetColumns, readApnSheetRows } from './apn-sheet';

export type ApnImportResult = {
  total: number;
  /** APNs used by plans but missing from the sheet, re-added for review. */
  addedFromPlans?: number;
  duplicates: string[];
  errors: Array<{ row: number; error: string }>;
};

/** What a plan is judged to support, given its APN (#065, #067). */
export type PlanAppSupport = {
  tiktokIos: boolean;
  tiktokAndroid: boolean;
  /** TikTok on both platforms — the only claim that holds for an unknown device. */
  tiktokAllDevices: boolean;
  chatGpt: boolean;
  /**
   * Whether the APN table (or the nonhkip marker) actually had an answer for this
   * plan — as opposed to all-false meaning "nothing is known".
   *
   * The distinction decides what the storefront may say out loud (#068). The table
   * exists to describe getting around China's blocking, so a Japan plan whose APN
   * was never listed comes back all-false — and printing "TikTok does not work"
   * off the back of that would be wrong, because in Japan it does.
   */
  known: boolean;
};

const NO_SUPPORT: PlanAppSupport = {
  tiktokIos: false,
  tiktokAndroid: false,
  tiktokAllDevices: false,
  chatGpt: false,
  known: false,
};

/** esimaccess states this in the package name instead of giving us an APN (#041). */
const NON_HK_IP_SUPPORT: PlanAppSupport = {
  tiktokIos: true,
  tiktokAndroid: true,
  tiktokAllDevices: true,
  chatGpt: true,
  known: true,
};

@Injectable()
export class ApnSupportService {
  private readonly logger = new Logger(ApnSupportService.name);

  constructor(private readonly apnRepository: ApnSupportRepository) {}

  findAllWithPagination({
    paginationOptions,
    filters,
  }: {
    paginationOptions: IPaginationOptions;
    filters?: ApnSupportFilters;
  }) {
    return this.apnRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
      filters,
    });
  }

  /** Every APN in the table, for the CMS filter's select box (#044). */
  listApns() {
    return this.apnRepository.listApns();
  }

  /** Add one APN by hand (#044, test round 4). */
  async create(input: Partial<ApnSupportRow> & { apnLabel: string }) {
    const apn = normalizeApn(input.apnLabel);
    if (!apn) throw new BadRequestException('APN không được để trống.');
    if (await this.apnRepository.findByApn(apn)) {
      throw new ConflictException(
        `APN "${input.apnLabel.trim()}" đã có trong danh sách.`,
      );
    }
    return this.apnRepository.create({
      ...emptyRow(apn, input.apnLabel.trim()),
      ...pickAppFields(input),
      note: input.note?.trim() || null,
      needsReview: false,
    });
  }

  /** Edit one row (#044). Filling it in clears "chưa có thông tin". */
  async update(id: string, input: Partial<ApnSupportRow>) {
    const current = await this.apnRepository.findById(id);
    if (!current) throw new NotFoundException('Không tìm thấy APN.');

    const patch: Partial<ApnSupportRow> = {
      ...pickAppFields(input),
      ...(input.note !== undefined && { note: input.note?.trim() || null }),
      needsReview: false,
    };
    if (input.apnLabel !== undefined) {
      const apn = normalizeApn(input.apnLabel);
      if (!apn) throw new BadRequestException('APN không được để trống.');
      const clash = await this.apnRepository.findByApn(apn);
      if (clash && clash.id !== id) {
        throw new ConflictException(
          `APN "${input.apnLabel.trim()}" đã có trong danh sách.`,
        );
      }
      patch.apn = apn;
      patch.apnLabel = input.apnLabel.trim();
    }
    return this.apnRepository.update(id, patch);
  }

  async remove(id: string) {
    await this.apnRepository.remove(id);
  }

  /**
   * Add every APN that supplier plans use but the table lacks, with its app
   * columns left as "chưa có thông tin" (#044, test round 4) — so the list
   * keeps up with what the APIs actually sell and nothing is missed. Daily, and
   * on demand from the CMS.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async syncFromPlans(): Promise<{ added: number; total: number }> {
    const rows = apnRowsFromPlanValues(
      await this.apnRepository.distinctPlanApns(),
    );
    const added = await this.apnRepository.insertMissing(rows);
    if (added > 0) {
      this.logger.log(
        `APN table: ${added} new APN(s) found on plans, awaiting review`,
      );
    }
    return { added, total: await this.apnRepository.count() };
  }

  /**
   * The whole table as an .xlsx in the same layout the import reads (#044,
   * test round 4), so the team can download it, fill the blanks and upload it
   * back. Rows not reviewed yet export with empty app cells.
   */
  async exportExcel(): Promise<Buffer> {
    const rows = await this.apnRepository.findAll();
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('APN Tiktok-GPT');
    sheet.columns = [
      { header: 'APN', key: 'apn', width: 28 },
      { header: 'TikTok iPhone', key: 'tiktokIos', width: 16 },
      { header: 'TikTok Android', key: 'tiktokAndroid', width: 16 },
      { header: 'ChatGPT', key: 'chatGpt', width: 14 },
      { header: 'Gemini', key: 'gemini', width: 14 },
      { header: 'Claude', key: 'claude', width: 14 },
      { header: 'Ghi chú', key: 'note', width: 48 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const row of exportRows(rows)) sheet.addRow(row);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  count() {
    return this.apnRepository.count();
  }

  /** APN → what it supports, for judging a batch of plans in one pass. */
  async capabilityMap(): Promise<Map<string, ApnCapabilities>> {
    const rows = await this.apnRepository.findAll();
    return new Map(
      // Not filled in yet: "we do not know", same as an APN not listed (#044).
      rows
        .filter((row) => !row.needsReview)
        .map((row) => [
          row.apn,
          {
            tiktok: { ios: row.tiktokIos, android: row.tiktokAndroid },
            chatGpt: { ios: row.chatGptIos, android: row.chatGptAndroid },
            gemini: { ios: row.geminiIos, android: row.geminiAndroid },
            claude: { ios: row.claudeIos, android: row.claudeAndroid },
          },
        ]),
    );
  }

  /**
   * What one plan supports.
   *
   * esimaccess gives no APN at all, and says it in the package name instead — its
   * "nonhkip" packages exit on a local IP, which is the whole point (#041). Every
   * other supplier is judged on its APN, and an APN that is not in the table is
   * "we do not know", which reads as no: a plan is only advertised as working with
   * TikTok when the table says so.
   */
  judgePlan(
    plan: { apn?: string | null; isNonHkIp?: boolean },
    capabilities: Map<string, ApnCapabilities>,
  ): PlanAppSupport {
    if (plan.isNonHkIp) return NON_HK_IP_SUPPORT;

    const apn = normalizeApn(plan.apn);
    if (!apn) return NO_SUPPORT;

    const caps = capabilities.get(apn);
    if (!caps) return NO_SUPPORT;

    return {
      tiktokIos: caps.tiktok.ios,
      tiktokAndroid: caps.tiktok.android,
      tiktokAllDevices: worksOnEveryDevice(caps.tiktok),
      // Cũng tính theo "chạy được cả 2 hệ máy" như TikTok: trang sản phẩm không
      // biết khách đang cầm máy gì (#068).
      chatGpt: worksOnEveryDevice(caps.chatGpt),
      known: true,
    };
  }

  /**
   * Replace the table from an uploaded sheet (#065).
   *
   * An upload is the authoritative list as of that moment, so it replaces what was
   * there — confirmed 1/10/2026. The sheet is refused outright when its header
   * cannot be read, rather than imported with columns we have guessed at.
   */
  async importFromExcel(buffer: Buffer): Promise<ApnImportResult> {
    const workbook = new Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        'Không đọc được file. Hãy tải lên file Excel (.xlsx).',
      );
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('File Excel không có sheet nào.');
    }

    // The header is not always the first row — sheets carry titles and blank
    // rows — so the first row that looks like a header wins.
    let columns: ReturnType<typeof findApnSheetColumns> = null;
    let headerRow = 0;
    const searchLimit = Math.min(sheet.rowCount, 20);
    for (let rowNumber = 1; rowNumber <= searchLimit; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const cells: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = cell.value;
      });
      const found = findApnSheetColumns(cells);
      if (found) {
        columns = found;
        headerRow = rowNumber;
        break;
      }
    }

    if (!columns) {
      throw new BadRequestException(
        'Không tìm thấy các cột bắt buộc. Sheet cần có tiêu đề cột: APN, TikTok iPhone, TikTok Android, ChatGPT.',
      );
    }

    const rowNumbers: number[] = [];
    for (
      let rowNumber = headerRow + 1;
      rowNumber <= sheet.rowCount;
      rowNumber += 1
    ) {
      rowNumbers.push(rowNumber);
    }

    const result = readApnSheetRows(columns, rowNumbers, (row, column) => {
      const value = sheet.getRow(row).getCell(column).value;
      // A formula cell carries its computed result alongside the formula.
      if (value && typeof value === 'object' && 'result' in value) {
        return (value as { result?: unknown }).result;
      }
      return value;
    });

    if (!result.rows.length) {
      throw new BadRequestException(
        'Sheet không có dòng APN nào đọc được — kiểm tra lại cột APN.',
      );
    }

    const total = await this.apnRepository.replaceAll(result.rows);
    this.logger.log(
      `APN table replaced: ${total} rows, ${result.duplicates.length} duplicate(s) skipped`,
    );

    // An upload replaces the table, so APNs that plans use but the sheet left
    // out come straight back as "chưa có thông tin" (#044, test round 4).
    let addedFromPlans = 0;
    try {
      addedFromPlans = (await this.syncFromPlans()).added;
    } catch (err) {
      this.logger.warn(
        `Could not re-add plan APNs after import — ${(err as Error).message}`,
      );
    }

    return {
      total,
      addedFromPlans,
      duplicates: result.duplicates,
      errors: result.errors,
    };
  }

  /** A blank verdict, for callers that need one before anything is uploaded. */
  static emptyCapabilities(): ApnCapabilities {
    return emptyCapabilities();
  }

  findByApn(apn: string): Promise<ApnSupport | null> {
    const normalized = normalizeApn(apn);
    if (!normalized) return Promise.resolve(null);
    return this.apnRepository.findByApn(normalized);
  }
}

function emptyRow(apn: string, apnLabel: string): ApnSupportRow {
  return {
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
    needsReview: false,
  };
}

const APP_FIELDS = [
  'tiktokIos',
  'tiktokAndroid',
  'chatGptIos',
  'chatGptAndroid',
  'geminiIos',
  'geminiAndroid',
  'claudeIos',
  'claudeAndroid',
] as const;

/** Only the yes/no columns, coerced to booleans. */
function pickAppFields(input: Partial<ApnSupportRow>): Partial<ApnSupportRow> {
  const out: Partial<ApnSupportRow> = {};
  for (const key of APP_FIELDS) {
    if (input[key] !== undefined) out[key] = !!input[key];
  }
  return out;
}

/**
 * The APN names inside one supplier `apn` value (#044, test round 4).
 *
 * Suppliers write this field freely: "cmhk", "cmhk / mobile.three.com.hk",
 * "cmlink or internet.proximus.be", a per-country map "AE:cmhk|AT:cmlink or
 * orange|…", or "APN：plus.4g | Username：plus | Password：4g". Only tokens that
 * look like an APN are kept — no spaces, letters/digits/.-_ — so a country map
 * yields its APNs and labels like "Username" or "Asia 13 Countries" are dropped.
 */
export function apnNamesIn(value: string | null | undefined): string[] {
  if (!value || typeof value !== 'string') return [];
  const names: string[] = [];
  for (const segment of value.split(/[|,;\n/]+|\s+or\s+/i)) {
    let token = segment.trim();
    // "APN：plus.4g" / "APN: plus.4g" — keep what follows the label.
    const labelled = token.match(/^apn\s*[:：]\s*(.+)$/i);
    if (labelled) token = labelled[1].trim();
    // "AE:cmhk", "UAE:cmhk", "MBLT:cmlink" — a country/region code prefix.
    else if (/^[A-Z]{2,5}\s*[:：]/.test(token)) {
      token = token.replace(/^[A-Z]{2,5}\s*[:：]\s*/, '');
    }
    if (/[:：]/.test(token)) continue; // "Username：plus", "Password：4g"
    if (!/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(token)) continue;
    if (!/[a-z]/i.test(token)) continue;
    names.push(token);
  }
  return names;
}

/** Plan APN values → one "awaiting review" row per distinct APN (#044). */
export function apnRowsFromPlanValues(values: string[]): ApnSupportRow[] {
  const seen = new Map<string, string>();
  for (const raw of values) {
    for (const label of apnNamesIn(raw)) {
      const apn = normalizeApn(label);
      if (apn && !seen.has(apn)) seen.set(apn, label);
    }
  }
  return [...seen].map(([apn, label]) => ({
    ...emptyRow(apn, label),
    needsReview: true,
  }));
}

/** Rows for the export sheet: unreviewed first, their app cells blank (#044). */
export function exportRows(rows: ApnSupport[]): Record<string, string>[] {
  const word = (yes: boolean) => (yes ? 'Hỗ trợ' : 'Không hỗ trợ');
  const sorted = [...rows].sort(
    (a, b) =>
      Number(Boolean(b.needsReview)) - Number(Boolean(a.needsReview)) ||
      a.apn.localeCompare(b.apn),
  );
  return sorted.map((row) => {
    const blank = Boolean(row.needsReview);
    return {
      apn: row.apnLabel,
      tiktokIos: blank ? '' : word(row.tiktokIos),
      tiktokAndroid: blank ? '' : word(row.tiktokAndroid),
      chatGpt: blank ? '' : word(row.chatGptIos && row.chatGptAndroid),
      gemini: blank ? '' : word(row.geminiIos && row.geminiAndroid),
      claude: blank ? '' : word(row.claudeIos && row.claudeAndroid),
      note: row.note ?? '',
    };
  });
}
