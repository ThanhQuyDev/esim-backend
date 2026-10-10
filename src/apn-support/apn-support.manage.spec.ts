import { apnRowsFromPlanValues, exportRows } from './apn-support.service';
import { ApnSupport } from './domain/apn-support';

/**
 * #044 (test round 4) — keeping the APN table complete and editable.
 *
 * The team asked for every APN the suppliers' plans use to land in the table on
 * its own, with blank answers to fill in, and for an export in the same layout
 * the import reads so the sheet can make the round trip.
 */
describe('APN table management (#044)', () => {
  describe('APNs found on plans', () => {
    it('should split multi-APN values and keep one row per APN', () => {
      const rows = apnRowsFromPlanValues([
        'cmhk',
        'CMHK , drei.at',
        'plus.4g;3gnet',
        '  ',
      ]);

      expect(rows.map((row) => row.apn)).toEqual([
        'cmhk',
        'drei.at',
        'plus.4g',
        '3gnet',
      ]);
    });

    it('should mark them as awaiting review, with nothing claimed', () => {
      const [row] = apnRowsFromPlanValues(['e-ideas']);

      expect(row).toMatchObject({
        apn: 'e-ideas',
        apnLabel: 'e-ideas',
        needsReview: true,
        tiktokIos: false,
        chatGptIos: false,
      });
    });
  });

  describe('export', () => {
    const row = (over: Partial<ApnSupport>): ApnSupport =>
      ({
        id: 'x',
        apn: 'cmhk',
        apnLabel: 'cmhk',
        tiktokIos: true,
        tiktokAndroid: false,
        chatGptIos: true,
        chatGptAndroid: true,
        geminiIos: true,
        geminiAndroid: true,
        claudeIos: false,
        claudeAndroid: false,
        note: 'Không hỗ trợ Tiktok trên Android và Claude',
        needsReview: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...over,
      }) as ApnSupport;

    it('should write the same words the import reads', () => {
      expect(exportRows([row({})])[0]).toEqual({
        apn: 'cmhk',
        tiktokIos: 'Hỗ trợ',
        tiktokAndroid: 'Không hỗ trợ',
        chatGpt: 'Hỗ trợ',
        gemini: 'Hỗ trợ',
        claude: 'Không hỗ trợ',
        note: 'Không hỗ trợ Tiktok trên Android và Claude',
      });
    });

    it('should leave unreviewed rows blank and list them first', () => {
      const rows = exportRows([
        row({}),
        row({
          apn: 'zz-new',
          apnLabel: 'zz-new',
          needsReview: true,
          note: null,
        }),
      ]);

      expect(rows[0]).toMatchObject({
        apn: 'zz-new',
        tiktokIos: '',
        chatGpt: '',
        claude: '',
      });
      expect(rows[1].apn).toBe('cmhk');
    });
  });
});
