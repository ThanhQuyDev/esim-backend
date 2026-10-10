import { existsSync } from 'fs';
import * as path from 'path';
import { Workbook } from 'exceljs';
import {
  findApnSheetColumns,
  parseDevice,
  parseYesNo,
  readApnSheetRows,
} from './apn-sheet';
import { normalizeApn, worksOnEveryDevice } from './apn-support.types';

/**
 * Reading the APN sheet (#065).
 *
 * This table decides what the storefront advertises as working with TikTok in
 * China. Every test here is about the same risk in one direction: a misread sheet
 * that marks a plan TikTok-capable when it is not, which a customer only finds out
 * about after landing.
 *
 * The real sheet (02/10/2026) is one row per APN AND device — the first version
 * of this parser was written from a description of a different layout and would
 * have rejected the actual file outright.
 */
describe('APN sheet', () => {
  describe('finding the columns', () => {
    it('should read the real sheet: a device column and one column per app', () => {
      const columns = findApnSheetColumns([
        'APN',
        'Thiết bị',
        'TikTok',
        'ChatGPT',
        'Gemini',
        'Claude',
      ]);

      expect(columns?.apn).toBe(1);
      expect(columns?.device).toBe(2);
      expect(columns?.apps).toEqual([
        { app: 'tiktok', device: null, column: 3 },
        { app: 'chatGpt', device: null, column: 4 },
        { app: 'gemini', device: null, column: 5 },
        { app: 'claude', device: null, column: 6 },
      ]);
    });

    it('should also read the wide layout, where the header names the device', () => {
      const columns = findApnSheetColumns([
        'APN',
        'TikTok iPhone',
        'TikTok Android',
        'ChatGPT',
      ]);

      expect(columns?.device).toBeUndefined();
      expect(columns?.apps).toEqual([
        { app: 'tiktok', device: 'ios', column: 2 },
        { app: 'tiktok', device: 'android', column: 3 },
        { app: 'chatGpt', device: null, column: 4 },
      ]);
    });

    it('should find columns by header, not by position', () => {
      // Someone inserting a column in front would otherwise shift every answer
      // one across — silently, and in the dangerous direction.
      const columns = findApnSheetColumns([
        'STT',
        'Ghi chú',
        'ChatGPT',
        'Thiết bị',
        'APN',
        'TikTok',
      ]);

      expect(columns?.apn).toBe(5);
      expect(columns?.device).toBe(4);
      expect(columns?.note).toBe(2);
      expect(columns?.apps.find((a) => a.app === 'tiktok')?.column).toBe(6);
    });

    it('should refuse a sheet with no APN or no app column', () => {
      expect(findApnSheetColumns(['Thiết bị', 'TikTok'])).toBeNull();
      expect(findApnSheetColumns(['APN', 'Ghi chú'])).toBeNull();
      expect(findApnSheetColumns([])).toBeNull();
    });
  });

  describe('yes/no cells', () => {
    it('should read the sheet’s own wording', () => {
      expect(parseYesNo('Hỗ trợ')).toBe(true);
      expect(parseYesNo('Không hỗ trợ')).toBe(false);
    });

    it('should not match "hỗ trợ" inside "không hỗ trợ"', () => {
      // A substring test here would inverт every negative answer in the file.
      expect(parseYesNo('  KHÔNG HỖ TRỢ  ')).toBe(false);
    });

    it('should read the other ways a person writes yes', () => {
      for (const yes of ['Có', 'YES', 'y', 'x', 'TRUE', '1', 'OK', true, 1]) {
        expect(parseYesNo(yes)).toBe(true);
      }
    });

    it('should read blank and anything unfamiliar as no', () => {
      for (const no of [
        'Không',
        'no',
        '0',
        '',
        '  ',
        null,
        undefined,
        '?',
        0,
      ]) {
        expect(parseYesNo(no)).toBe(false);
      }
    });
  });

  describe('the device column', () => {
    it('should read the two the sheet uses', () => {
      expect(parseDevice('iPhone')).toBe('ios');
      expect(parseDevice('Android')).toBe('android');
      expect(parseDevice(' ANDROID ')).toBe('android');
      expect(parseDevice('iOS')).toBe('ios');
    });

    it('should return null for anything else', () => {
      expect(parseDevice('Windows')).toBeNull();
      expect(parseDevice('')).toBeNull();
    });
  });

  describe('reading the rows', () => {
    const LONG = {
      apn: 1,
      device: 2,
      apps: [
        { app: 'tiktok' as const, device: null, column: 3 },
        { app: 'chatGpt' as const, device: null, column: 4 },
      ],
    };

    /** A sheet as a plain grid, 1-based like exceljs. */
    const grid = (rows: unknown[][]) => (row: number, column: number) =>
      rows[row - 1]?.[column - 1];

    it('should merge an APN’s two device rows into one record', () => {
      // The worked example from the real sheet: cmhk runs TikTok on iPhone only.
      const result = readApnSheetRows(
        LONG,
        [1, 2],
        grid([
          ['cmhk', 'Android', 'Không hỗ trợ', 'Hỗ trợ'],
          ['cmhk', 'iPhone', 'Hỗ trợ', 'Hỗ trợ'],
        ]),
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        apn: 'cmhk',
        tiktokIos: true,
        tiktokAndroid: false,
        chatGptIos: true,
        chatGptAndroid: true,
      });
    });

    it('should keep the sheet’s spelling but match on a normalised key', () => {
      const result = readApnSheetRows(
        LONG,
        [1],
        grid([['  CMHK  ', 'iPhone', 'Hỗ trợ', 'Hỗ trợ']]),
      );

      expect(result.rows[0].apn).toBe('cmhk');
      expect(result.rows[0].apnLabel).toBe('CMHK');
    });

    it('should leave a device that has no row as "no"', () => {
      // Half a pair is not a reason to assume the other half works.
      const result = readApnSheetRows(
        LONG,
        [1],
        grid([['solo', 'iPhone', 'Hỗ trợ', 'Hỗ trợ']]),
      );

      expect(result.rows[0]).toMatchObject({
        tiktokIos: true,
        tiktokAndroid: false,
      });
    });

    it('should report a row whose device cell cannot be read', () => {
      const result = readApnSheetRows(
        LONG,
        [1],
        grid([['cmhk', 'Máy tính bảng?', 'Hỗ trợ', 'Hỗ trợ']]),
      );

      expect(result.rows).toHaveLength(0);
      expect(result.errors[0].error).toContain('Thiết bị');
    });

    it('should skip blank rows without calling them errors', () => {
      const result = readApnSheetRows(
        LONG,
        [1, 2, 3],
        grid([['cmhk', 'iPhone', 'Hỗ trợ', 'Hỗ trợ'], [], ['', '', '', '']]),
      );

      expect(result.rows).toHaveLength(1);
      expect(result.errors).toEqual([]);
    });

    it('should keep the first of a repeated APN+device and report the rest', () => {
      const result = readApnSheetRows(
        LONG,
        [1, 2],
        grid([
          ['cmhk', 'iPhone', 'Hỗ trợ', 'Hỗ trợ'],
          ['CMHK', 'iPhone', 'Không hỗ trợ', 'Không hỗ trợ'],
        ]),
      );

      expect(result.rows[0].tiktokIos).toBe(true);
      expect(result.duplicates).toEqual(['CMHK (ios)']);
    });

    it('should apply a wide-layout answer to both devices when no device is named', () => {
      const result = readApnSheetRows(
        {
          apn: 1,
          apps: [
            { app: 'tiktok', device: 'ios', column: 2 },
            { app: 'tiktok', device: 'android', column: 3 },
            { app: 'chatGpt', device: null, column: 4 },
          ],
        },
        [1],
        grid([['wide', 'Có', 'Không', 'Có']]),
      );

      expect(result.rows[0]).toMatchObject({
        tiktokIos: true,
        tiktokAndroid: false,
        chatGptIos: true,
        chatGptAndroid: true,
      });
    });
  });

  describe('the real file the team maintains', () => {
    const FILE = path.join(
      'C:',
      'Users',
      'ttquy',
      'Downloads',
      'UPDATE - PHASE 2_ESIM.VN 2026 (3).xlsx',
    );
    // The team's spreadsheet lives on one laptop and gets renamed as new
    // copies arrive; without it there is nothing to read, not a failure.
    const itWithFile = existsSync(FILE) ? it : it.skip;

    itWithFile('should read "APN Tiktok-GPT" end to end', async () => {
      const wb = new Workbook();
      await wb.xlsx.readFile(FILE);
      const sheet = wb.getWorksheet('APN Tiktok-GPT')!;

      const headerCells: unknown[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
        headerCells[col - 1] = cell.value;
      });
      const columns = findApnSheetColumns(headerCells);
      expect(columns).not.toBeNull();

      const rowNumbers: number[] = [];
      for (let r = 2; r <= sheet.rowCount; r++) rowNumbers.push(r);

      const result = readApnSheetRows(
        columns!,
        rowNumbers,
        (row, col) => sheet.getRow(row).getCell(col).value,
      );

      // 46 APNs, one row each (round 4 wide layout: TikTok iPhone/Android,
      // ChatGPT, Gemini, Claude). Round 4 reported ChatGPT importing as "Không"
      // — the sheet read fine; the CMS table read a field that no longer exists.
      expect(result.rows).toHaveLength(46);
      expect(result.errors).toEqual([]);
      expect(result.duplicates).toEqual([]);

      const cmhk = result.rows.find((r) => r.apn === 'cmhk')!;
      expect(cmhk).toMatchObject({
        tiktokIos: true,
        tiktokAndroid: false,
        chatGptIos: true,
        chatGptAndroid: true,
        geminiIos: true,
        geminiAndroid: true,
        claudeIos: false,
        claudeAndroid: false,
      });
      const withGpt = result.rows.filter(
        (r) => r.chatGptIos && r.chatGptAndroid,
      );
      expect(withGpt.length).toBeGreaterThan(30);

      // cmhk chạy TikTok trên iPhone nhưng không trên Android, nên không được
      // tính là "dùng được" khi web chưa biết khách cầm máy gì.
      expect(
        worksOnEveryDevice({
          ios: cmhk.tiktokIos,
          android: cmhk.tiktokAndroid,
        }),
      ).toBe(false);
    });
  });

  describe('normalizeApn', () => {
    it('should treat blank as no APN at all', () => {
      expect(normalizeApn('  ')).toBeNull();
      expect(normalizeApn(null)).toBeNull();
      expect(normalizeApn(' CMHK ')).toBe('cmhk');
    });
  });
});
