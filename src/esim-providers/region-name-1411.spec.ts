import { regionNameFromPlan } from './catalogue-naming';
import { billionRegionName } from './billion/billion-catalogue';
import { EsimAccessService } from './esimaccess/esimaccess.service';

/**
 * vande-1411 #027 — a region takes the supplier's own name, with only the
 * data, calls/SMS and validity cut, so an admin searching the supplier's plan
 * list by region name finds them. A name set in the CMS is never touched.
 */
describe('Tên khu vực theo tên gốc của nhà cung cấp (vande-1411 #027)', () => {
  it('should cut only the data, calls/SMS and validity', () => {
    expect(regionNameFromPlan('Asia (12 areas) 2GB/Day')).toBe(
      'Asia (12 areas)',
    );
    expect(regionNameFromPlan('Middle East (5 areas) 10GB/Day')).toBe(
      'Middle East (5 areas)',
    );
    expect(regionNameFromPlan('Europe (31 areas) 10GB 31Days')).toBe(
      'Europe (31 areas)',
    );
    expect(regionNameFromPlan('Africa (21 areas) 1GB/Day FUP1Mbps')).toBe(
      'Africa (21 areas)',
    );
    expect(
      regionNameFromPlan(
        'Singapore & Malaysia & Vietnam & Thailand & Indonesia 10GB/Day',
      ),
    ).toBe('Singapore & Malaysia & Vietnam & Thailand & Indonesia');
    expect(regionNameFromPlan('Central Asia 1GB/Day FUP1Mbps')).toBe(
      'Central Asia',
    );
    expect(regionNameFromPlan('Global (120+ areas) Unlimited 7Days')).toBe(
      'Global (120+ areas)',
    );
  });

  it("should keep Billion's name as it was", () => {
    expect(
      billionRegionName({
        name: 'Orange Holiday Europe-31Days-4GB-Orange-eSIM Carrier',
        country: [],
      } as never),
    ).toBe('Orange Holiday Europe');
  });

  function esimAccess(existing: Record<string, unknown> | null) {
    const s = Object.create(EsimAccessService.prototype) as EsimAccessService;
    const regionsService = {
      findByExternalCode: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(undefined),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve({ id: 9, ...data })),
    };
    Object.assign(s as unknown as Record<string, unknown>, {
      regionsService,
      destinationsService: { addRegion: jest.fn() },
    });
    return { s, regionsService };
  }
  const pkg = {
    name: 'Middle East (5 areas) 10GB/Day',
    locationCode: 'ME-5',
    locationNetworkList: [],
  };

  it('should name a new eSIMAccess region after the supplier', async () => {
    const { s, regionsService } = esimAccess(null);
    await (
      s as never as {
        resolveRegion: (p: unknown, c: string[]) => Promise<unknown>;
      }
    ).resolveRegion(pkg, []);
    expect(regionsService.create.mock.calls[0][0].name).toBe(
      'Middle East (5 areas)',
    );
  });

  it('should rename one the old sync named "Middle", and leave one the CMS named', async () => {
    const old = esimAccess({ id: 3, name: 'Middle', slug: 'esimaccess-me-5' });
    await (
      old.s as never as {
        resolveRegion: (p: unknown, c: string[]) => Promise<unknown>;
      }
    ).resolveRegion(pkg, []);
    expect(old.regionsService.update).toHaveBeenCalledWith(3, {
      name: 'Middle East (5 areas)',
    });

    const edited = esimAccess({
      id: 4,
      name: 'Trung Đông (Middle East)',
      slug: 'x',
    });
    await (
      edited.s as never as {
        resolveRegion: (p: unknown, c: string[]) => Promise<unknown>;
      }
    ).resolveRegion(pkg, []);
    expect(edited.regionsService.update).not.toHaveBeenCalled();
  });
});
