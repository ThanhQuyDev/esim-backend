import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ApnSupportService } from '../apn-support/apn-support.service';
import { PlansService } from './plans.service';

/**
 * The esimaccess price file (vande-0411 #027). Its API gives no APN before an
 * order is placed, so the supplier's own package list fills that in.
 *
 * It only adds to plans the sync already brought: a code we do not sell is
 * reported, never created, and price, name and sale status stay with the sync.
 */
export interface EsimAccessFileRow {
  code: string;
  apn: string | null;
  billingStarts: string | null;
}

export interface EsimAccessImportResult {
  /** Rows with a package code. */
  total: number;
  updated: number;
  notInCatalog: string[];
  /** Codes the file gives no APN for ("-" or blank). */
  noApn: string[];
  /** APNs the APN table has no answer for, with how many plans use each. */
  unknownApns: { apn: string; plans: number }[];
  /** Where the file and the supplier's API disagree on when a plan starts. */
  billingMismatches: { code: string; file: string; api: number }[];
}

/** Billing starts → the `activeType` the API gives for it. */
const BILLING_ACTIVE_TYPE: Record<string, number> = {
  'first installation': 1,
  'first network connection': 2,
  'after purchase': 3,
};

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[\s_]+/g, '');

const REQUIRED_HEADERS = ['id', 'apn', 'billingstarts'];

/** RFC 4180: "Operator Networks" holds commas inside quotes. */
export function parseCsvRows(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  // Excel in a Vietnamese locale saves CSV with semicolons.
  const separator =
    firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

async function readSheetRows(buffer: Buffer): Promise<string[][]> {
  // An .xlsx is a zip: the CSV may have been opened and saved from Excel.
  if (buffer.subarray(0, 2).toString('latin1') !== 'PK') {
    return parseCsvRows(buffer.toString('utf8').replace(/^﻿/, ''));
  }
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as never);
  } catch {
    throw new BadRequestException('Không đọc được file Excel này.');
  }
  const rows: string[][] = [];
  workbook.worksheets[0]?.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let col = 1; col <= row.cellCount; col += 1) {
      cells.push(row.getCell(col).text ?? '');
    }
    rows.push(cells);
  });
  return rows;
}

/** Columns are found by name, so a reordered file still reads correctly. */
export function fileRowsFrom(rows: string[][]): EsimAccessFileRow[] {
  const header = (rows[0] ?? []).map(normalizeHeader);
  const missing = REQUIRED_HEADERS.filter((name) => !header.includes(name));
  if (missing.length) {
    throw new BadRequestException(
      'File thiếu cột ID, APN hoặc Billing starts. Hãy dùng đúng file danh sách gói của esimaccess.',
    );
  }
  const [id, apn, billing] = REQUIRED_HEADERS.map((n) => header.indexOf(n));
  const seen = new Set<string>();
  const result: EsimAccessFileRow[] = [];
  for (const row of rows.slice(1)) {
    const code = (row[id] ?? '').trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const apnText = (row[apn] ?? '').trim();
    result.push({
      code,
      apn: apnText && apnText !== '-' ? apnText : null,
      billingStarts: (row[billing] ?? '').trim() || null,
    });
  }
  return result;
}

@Injectable()
export class PlansEsimaccessImportService {
  constructor(
    private readonly plansService: PlansService,
    private readonly apnSupportService: ApnSupportService,
  ) {}

  async importFile(buffer: Buffer): Promise<EsimAccessImportResult> {
    const rows = fileRowsFrom(await readSheetRows(buffer));
    if (!rows.length) {
      throw new BadRequestException('File không có dòng gói nào.');
    }

    const matched = await this.plansService.applyEsimAccessFile(rows);
    const activeTypeOf = new Map(
      matched.map((plan) => [plan.providerPlanId, plan.supplierActiveType]),
    );
    const capabilities = await this.apnSupportService.capabilityMap();

    const unknown = new Map<string, number>();
    const billingMismatches: EsimAccessImportResult['billingMismatches'] = [];
    for (const row of rows) {
      if (!activeTypeOf.has(row.code)) continue;
      if (
        row.apn &&
        !this.apnSupportService.judgePlan({ apn: row.apn }, capabilities).known
      ) {
        unknown.set(row.apn, (unknown.get(row.apn) ?? 0) + 1);
      }
      const fromFile =
        BILLING_ACTIVE_TYPE[(row.billingStarts ?? '').toLowerCase()];
      const fromApi = activeTypeOf.get(row.code);
      if (fromFile && fromApi && fromFile !== Number(fromApi)) {
        billingMismatches.push({
          code: row.code,
          file: row.billingStarts as string,
          api: Number(fromApi),
        });
      }
    }

    return {
      total: rows.length,
      updated: matched.length,
      notInCatalog: rows
        .filter((row) => !activeTypeOf.has(row.code))
        .map((row) => row.code),
      noApn: rows
        .filter((row) => activeTypeOf.has(row.code) && !row.apn)
        .map((row) => row.code),
      unknownApns: [...unknown]
        .map(([apn, plans]) => ({ apn, plans }))
        .sort((a, b) => b.plans - a.plans),
      billingMismatches,
    };
  }
}
