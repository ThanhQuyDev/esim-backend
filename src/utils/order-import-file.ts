import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { vnFold } from './vn-fold';

/**
 * The list of eSIMs to order, read from a spreadsheet (doitac-1410 #084).
 *
 * Admin "Đặt đơn hộ khách" and the partner cart both take the same file: one
 * row per plan, by its code (the slug, the "Mã gói cước" column of the
 * partner price list export) and a quantity, plus — partner only — the email
 * the QR codes of that row go to. The file only fills an order; the order is
 * then placed through the existing flow, priced by the server as before.
 */
export type OrderImportRow = {
  /** The spreadsheet row number, so an error points at the right line. */
  row: number;
  slug: string;
  quantity: number;
  email: string | null;
  error: string | null;
};

export const ORDER_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_QUANTITY = 1000;

/** Header titles each column is recognised by, folded (no accents, lower). */
const COLUMNS = {
  slug: ['ma goi cuoc', 'ma goi', 'slug', 'plan code', 'package code'],
  quantity: ['so luong', 'sl', 'quantity', 'qty'],
  email: ['email nhan qr', 'email nhan ma qr', 'email', 'email khach'],
} as const;

type Column = keyof typeof COLUMNS;

function fold(value: string): string {
  return vnFold(value).replace(/\s+/g, ' ').trim();
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const v = value as {
      text?: unknown;
      result?: unknown;
      richText?: { text: string }[];
      hyperlink?: unknown;
    };
    if (Array.isArray(v.richText))
      return v.richText.map((r) => r.text).join('');
    if (v.text !== undefined) return cellText(v.text);
    if (v.result !== undefined) return cellText(v.result);
    return '';
  }
  return String(value).trim();
}

/** RFC 4180-ish: quoted fields, doubled quotes, comma or semicolon. */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  // Excel in a Vietnamese locale saves CSV with semicolons.
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
}

async function readGrid(buffer: Buffer, filename: string): Promise<string[][]> {
  const name = filename.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseCsv(buffer.toString('utf8'));
  }
  if (!name.endsWith('.xlsx')) {
    throw new BadRequestException('Chỉ nhận file .xlsx hoặc .csv.');
  }
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw new BadRequestException(
      'Không đọc được file Excel. Hãy lưu lại dạng .xlsx rồi thử lại.',
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (r, rowNumber) => {
    const cells: string[] = [];
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellText(cell.value);
    });
    grid[rowNumber - 1] = Array.from(cells, (c) => c ?? '');
  });
  return Array.from(grid, (r) => r ?? []);
}

/**
 * Reads the rows of an order file. Throws when the file itself is unusable
 * (wrong type, no "Mã gói cước" column, no rows, more rows than one order
 * takes); a bad row is returned with its `error` so the whole list can be
 * fixed at once.
 */
export async function parseOrderImportFile(
  buffer: Buffer,
  filename: string,
  options: { maxRows: number; withEmail: boolean },
): Promise<OrderImportRow[]> {
  if (!buffer?.length) {
    throw new BadRequestException('File trống.');
  }
  if (buffer.length > ORDER_IMPORT_MAX_BYTES) {
    throw new BadRequestException('File quá lớn (tối đa 2 MB).');
  }
  const grid = await readGrid(buffer, filename);

  // The header is the first of the top rows that names the plan code column.
  let headerIndex = -1;
  const columnIndex: Partial<Record<Column, number>> = {};
  for (let r = 0; r < Math.min(5, grid.length) && headerIndex < 0; r += 1) {
    const titles = grid[r].map((c) => fold(c));
    const find = (column: Column) =>
      titles.findIndex((t) =>
        (COLUMNS[column] as readonly string[]).includes(t),
      );
    if (find('slug') >= 0) {
      headerIndex = r;
      for (const column of Object.keys(COLUMNS) as Column[]) {
        const i = find(column);
        if (i >= 0) columnIndex[column] = i;
      }
    }
  }
  if (headerIndex < 0) {
    throw new BadRequestException(
      'Không thấy cột "Mã gói cước" trong file. Hãy dùng file mẫu.',
    );
  }

  const rows: OrderImportRow[] = [];
  for (let r = headerIndex + 1; r < grid.length; r += 1) {
    const cells = grid[r];
    const at = (column: Column) =>
      columnIndex[column] === undefined
        ? ''
        : (cells[columnIndex[column]!] ?? '').trim();
    const slug = at('slug');
    const rawQuantity = at('quantity');
    const rawEmail = options.withEmail ? at('email') : '';
    // A blank line between rows, or the end of the sheet.
    if (!slug && !rawQuantity && !rawEmail) continue;

    // Quantity left out means one eSIM.
    const quantity = rawQuantity === '' ? 1 : Number(rawQuantity);
    let error: string | null = null;
    if (!slug) error = 'Thiếu mã gói cước.';
    else if (!Number.isInteger(quantity) || quantity < 1)
      error = 'Số lượng phải là số nguyên từ 1 trở lên.';
    else if (quantity > MAX_QUANTITY)
      error = `Số lượng tối đa ${MAX_QUANTITY} mỗi dòng.`;
    else if (rawEmail && !EMAIL.test(rawEmail)) error = 'Email không hợp lệ.';

    rows.push({
      row: r + 1,
      slug,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      email: rawEmail ? rawEmail.toLowerCase() : null,
      error,
    });
  }

  if (!rows.length) {
    throw new BadRequestException('File chưa có dòng gói cước nào.');
  }
  if (rows.length > options.maxRows) {
    throw new BadRequestException(
      `File có ${rows.length} dòng, mỗi lần nhập tối đa ${options.maxRows} dòng. Hãy tách thành nhiều file.`,
    );
  }
  return rows;
}

/** The template both screens offer for download. */
export async function orderImportTemplate(withEmail: boolean): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = 'esim.vn';
  const sheet = workbook.addWorksheet('Danh sách đặt eSIM');
  sheet.columns = [
    { header: 'Mã gói cước', key: 'slug', width: 36 },
    { header: 'Số lượng', key: 'quantity', width: 10 },
    ...(withEmail
      ? [{ header: 'Email nhận QR', key: 'email', width: 32 }]
      : []),
  ];
  sheet.addRow({
    slug: 'vi-du-ma-goi-cuoc',
    quantity: 2,
    ...(withEmail ? { email: 'khach@example.com' } : {}),
  });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
