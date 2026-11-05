import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ApnSupportService } from '../apn-support/apn-support.service';
import {
  fileRowsFrom,
  parseCsvRows,
  PlansEsimaccessImportService,
} from './plans-esimaccess-import.service';

const CSV = [
  'Type,Name,ID,Billing starts,APN,Operator Networks',
  'Single,China 1GB/Day,P92TALXP8,First Network Connection,cmlink,China Mobile [5G]',
  'Single,Malaysia,PIZYDS75Z,First Installation,e-ideas,"Maxis [5G], CelcomDigi [5G]"',
  'Single,Eswatini,PA96WBQ5V,After Purchase,-,MTN',
  'Single,Not sold,PNOTSOLD1,First Installation,orange,X',
].join('\r\n');

describe('esimaccess price file (vande-0411 #027)', () => {
  function service(activeTypes: Record<string, number | null>) {
    const plans = {
      applyEsimAccessFile: jest.fn((rows: { code: string }[]) =>
        Promise.resolve(
          rows
            .filter((row) => row.code in activeTypes)
            .map((row) => ({
              providerPlanId: row.code,
              supplierActiveType: activeTypes[row.code],
            })),
        ),
      ),
    };
    const apn = new ApnSupportService({} as never);
    jest.spyOn(apn, 'capabilityMap').mockResolvedValue(
      new Map([
        [
          'cmlink',
          {
            tiktok: { ios: true, android: false },
            chatGpt: { ios: true, android: true },
            gemini: { ios: true, android: true },
            claude: { ios: false, android: false },
          },
        ],
      ]) as never,
    );
    return {
      plans,
      svc: new PlansEsimaccessImportService(plans as never, apn),
    };
  }

  it('should keep commas inside a quoted cell', () => {
    expect(parseCsvRows('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
  });

  it('should read a CSV saved with semicolons', () => {
    expect(parseCsvRows('a;b\n1,5;2\n')).toEqual([
      ['a', 'b'],
      ['1,5', '2'],
    ]);
  });

  it('should find columns by name and treat "-" as no APN', () => {
    expect(fileRowsFrom(parseCsvRows(CSV))).toEqual([
      {
        code: 'P92TALXP8',
        apn: 'cmlink',
        billingStarts: 'First Network Connection',
      },
      {
        code: 'PIZYDS75Z',
        apn: 'e-ideas',
        billingStarts: 'First Installation',
      },
      { code: 'PA96WBQ5V', apn: null, billingStarts: 'After Purchase' },
      { code: 'PNOTSOLD1', apn: 'orange', billingStarts: 'First Installation' },
    ]);
  });

  it('should refuse a file without the columns it needs', async () => {
    const { svc, plans } = service({});
    await expect(
      svc.importFile(Buffer.from('Name,Price\nChina,1\n')),
    ).rejects.toThrow(BadRequestException);
    expect(plans.applyEsimAccessFile).not.toHaveBeenCalled();
  });

  it('should report what the file could not settle', async () => {
    const { svc } = service({
      P92TALXP8: 2,
      PIZYDS75Z: 2,
      PA96WBQ5V: 3,
    });
    await expect(svc.importFile(Buffer.from(CSV))).resolves.toEqual({
      total: 4,
      updated: 3,
      notInCatalog: ['PNOTSOLD1'],
      noApn: ['PA96WBQ5V'],
      unknownApns: [{ apn: 'e-ideas', plans: 1 }],
      billingMismatches: [
        { code: 'PIZYDS75Z', file: 'First Installation', api: 2 },
      ],
    });
  });

  it('should read the same file saved as .xlsx', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow(['ID', 'Billing starts', 'APN']);
    sheet.addRow(['P92TALXP8', 'First Network Connection', 'cmlink']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const { svc } = service({ P92TALXP8: 2 });
    await expect(svc.importFile(buffer)).resolves.toMatchObject({
      total: 1,
      updated: 1,
      unknownApns: [],
    });
  });
});
