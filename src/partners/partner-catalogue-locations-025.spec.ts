import { PartnersService } from './partners.service';

/**
 * doitac-3010 #025 — the price list's "Điểm đến" reads like the admin's
 * country / region picker: the Vietnamese name with the English beside it,
 * found by either, and by Vietnamese typed without its marks.
 */
describe('Catalogue destinations (doitac-3010 #025)', () => {
  it('should label and index each destination in both languages', async () => {
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      dataSource: {
        query: jest.fn().mockResolvedValue([
          { value: 'd:2', name: 'China', titleVi: 'Trung Quốc', region: false },
          { value: 'r:1', name: 'Europe', titleVi: 'Châu Âu', region: true },
          { value: 'd:3', name: 'Japan', titleVi: null, region: false },
        ]),
      },
    });

    const options = await service.getCatalogueLocations();

    expect(options.map((o) => o.label)).toEqual([
      'Khu vực: Châu Âu (Europe)',
      'Japan',
      'Trung Quốc (China)',
    ]);
    expect(options[2].keywords).toEqual(
      expect.arrayContaining(['Trung Quốc', 'China', 'Trung Quoc']),
    );
  });
});
