import {
  apnNamesIn,
  apnRowsFromPlanValues,
  chinaApnCandidates,
  combineCapabilities,
  exportRows,
} from './apn-support.service';
import { ApnCapabilities } from './apn-support.types';
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

  describe('reading a supplier APN field', () => {
    it.each([
      ['cmhk', ['cmhk']],
      ['cmhk / mobile.three.com.hk', ['cmhk', 'mobile.three.com.hk']],
      ['cmlink or internet.proximus.be', ['cmlink', 'internet.proximus.be']],
      [
        'AE:cmhk|AT:cmlink or orange|UAE:cmhk',
        ['cmhk', 'cmlink', 'orange', 'cmhk'],
      ],
      [
        'APN：plus.4g | Username：plus | Password：4g | Authentication Type：CHAP',
        ['plus.4g'],
      ],
      ['APN：au.5g.au-net.ne.jp', ['au.5g.au-net.ne.jp']],
      ['Asia 13 Countries', []],
      ['[object Object]', []],
    ])('should read %s', (value, expected) => {
      expect(apnNamesIn(value)).toEqual(expected);
    });

    it('should collect one row per APN across country maps', () => {
      const rows = apnRowsFromPlanValues([
        'AE:cmhk|AG:cmhk|GU:mobile.three.com.hk / share.three.com.hk',
      ]);
      expect(rows.map((row) => row.apn)).toEqual([
        'cmhk',
        'mobile.three.com.hk',
        'share.three.com.hk',
      ]);
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

  describe('region packs and several APNs (#046)', () => {
    const caps = (tiktok: boolean, gpt: boolean): ApnCapabilities => ({
      tiktok: { ios: tiktok, android: tiktok },
      chatGpt: { ios: gpt, android: gpt },
      gemini: { ios: true, android: true },
      claude: { ios: false, android: false },
    });
    const TABLE = new Map<string, ApnCapabilities>([
      ['e-ideas', caps(true, true)],
      ['cmhk', caps(false, true)],
    ]);

    it("should read only China's entry of a per-country map", () => {
      expect(chinaApnCandidates('AE:cmhk|CN:e-ideas|JP:cmhk')).toEqual([
        'e-ideas',
      ]);
      expect(chinaApnCandidates('AE:cmhk|JP:cmhk')).toEqual([]);
    });

    it('should judge a region pack by its China APN', () => {
      expect(
        combineCapabilities('AE:cmhk|CN:e-ideas|JP:cmhk', TABLE)?.tiktok,
      ).toEqual({ ios: true, android: true });
    });

    it('should need every alternative APN to work', () => {
      const combined = combineCapabilities('e-ideas / cmhk', TABLE);
      expect(combined?.tiktok).toEqual({ ios: false, android: false });
      expect(combined?.chatGpt).toEqual({ ios: true, android: true });
    });

    it('should know nothing when no candidate is in the table', () => {
      expect(combineCapabilities('foo / bar', TABLE)).toBeNull();
    });
  });
});
