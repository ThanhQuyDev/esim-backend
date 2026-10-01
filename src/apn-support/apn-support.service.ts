import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ApnSupportRepository } from './infrastructure/persistence/apn-support.repository';
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
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.apnRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  count() {
    return this.apnRepository.count();
  }

  /** APN → what it supports, for judging a batch of plans in one pass. */
  async capabilityMap(): Promise<Map<string, ApnCapabilities>> {
    const rows = await this.apnRepository.findAll();
    return new Map(
      rows.map((row) => [
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

    return {
      total,
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
