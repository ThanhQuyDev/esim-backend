import {
  cleanGadgetApn,
  PlansGadgetkoreaImportService,
  resolveGadgetColumns,
} from './plans-gadgetkorea-import.service';

const OLD_HEADER = [
  'SIM Type',
  'Plan',
  'Day',
  'Data',
  'Option Name',
  'Carrier',
  'Network',
  'Access Type',
  'QOS',
  'Validity',
  'APN',
  'PreInstallation',
  'Top-up',
  'KYC',
  'Hot-Spot',
  'Hot-Spot Allow',
  'Initialize policy',
  'Option ID (For API)',
  'Normal Price',
  'Min.Sell Price',
  'B2B Price',
];
// The 20/10/2026 price file: an "IP" column after Access Type (vande #018).
const NEW_HEADER = [...OLD_HEADER.slice(0, 8), 'IP', ...OLD_HEADER.slice(8)];

describe('Gadget Korea import columns (vande #018)', () => {
  it('should find the shifted columns of the new file by their header', () => {
    const cols = resolveGadgetColumns(NEW_HEADER);
    expect(cols.IP).toBe(9);
    expect(cols.QOS).toBe(10);
    expect(cols.APN).toBe(12);
    expect(cols.OPTION_ID).toBe(19);
    expect(cols.B2B_PRICE).toBe(22);
  });

  it('should read the old file exactly as before, with no IP column', () => {
    const cols = resolveGadgetColumns(OLD_HEADER);
    expect(cols.IP).toBeNull();
    expect(cols.APN).toBe(11);
    expect(cols.OPTION_ID).toBe(18);
    expect(cols.B2B_PRICE).toBe(21);
  });

  it('should fall back to the original positions when the header is unreadable', () => {
    const cols = resolveGadgetColumns(['', null, 'foo']);
    expect(cols.OPTION_ID).toBe(18);
    expect(cols.IP).toBeNull();
  });

  it('should tidy the APN list', () => {
    expect(cleanGadgetApn('cmlink / internet.proximus.be  / cmhk ')).toBe(
      'cmlink / internet.proximus.be / cmhk',
    );
    expect(cleanGadgetApn('cmhk')).toBe('cmhk');
    expect(cleanGadgetApn(' / ')).toBeNull();
    expect(cleanGadgetApn(null)).toBeNull();
  });
});

describe('Gadget Korea import cell text (vande #018)', () => {
  it('should read a rich-text cell as its text, not "[object Object]"', () => {
    const service = new PlansGadgetkoreaImportService(
      {} as never,
      {} as never,
      {} as never,
    );
    const getString = (
      service as unknown as { getString: (v: unknown) => string | null }
    ).getString.bind(service);
    expect(
      getString({ richText: [{ text: 'cmlink / ' }, { text: 'cmhk' }] }),
    ).toBe('cmlink / cmhk');
  });
});
