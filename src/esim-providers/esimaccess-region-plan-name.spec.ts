import { EsimAccessService } from './esimaccess/esimaccess.service';

/**
 * Regional eSIM Access packages were being named after
 * `locationNetworkList[0].locationName` — whichever country the provider
 * happened to list first.
 *
 * Real payload from their catalogue:
 *   name: "Europe 3GB 30Days", locationCode: "EU-42",
 *   locationNetworkList[0].locationName: "Aland Islands"
 *
 * So the Europe pack was stored as "Aland Islands 3GB / 30day" — unfindable,
 * because nobody can guess which country came first (#036). A regional plan
 * must be named after its region instead.
 */

/** Shape of the real Europe package, trimmed to the fields the sync reads. */
function europePackage() {
  return {
    packageCode: 'EU42-3GB-30D',
    name: 'Europe 3GB 30Days',
    location: 'NO,RS,DE,BE,FI,PT,BG,DK,LT,LU,LV,HR,UA,FR',
    locationCode: 'EU-42',
    locationNetworkList: [
      { locationCode: 'AX', locationName: 'Aland Islands', operatorList: [] },
      { locationCode: 'DE', locationName: 'Germany', operatorList: [] },
    ],
    volume: 3 * 1024 * 1024 * 1024,
    duration: 30,
    dataType: 1,
    price: 50000,
    retailPrice: 80000,
    currencyCode: 'USD',
    supportTopUpType: 1,
    speed: '4G',
    fupPolicy: null,
  };
}

/** Single-country package: naming must stay exactly as it was. */
function spainPackage() {
  return {
    ...europePackage(),
    packageCode: 'ES-3GB-30D',
    name: 'Spain 3GB 30Days',
    location: 'ES',
    locationCode: 'ES',
    locationNetworkList: [
      { locationCode: 'ES', locationName: 'Spain', operatorList: [] },
    ],
  };
}

function makeService(opts: { existingRegionName?: string } = {}) {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];

  const plansService = {
    findBySlug: jest.fn().mockResolvedValue(null),
    create: jest.fn((payload: Record<string, unknown>) => {
      created.push(payload);
      return Promise.resolve({ id: 1, ...payload });
    }),
    update: jest.fn((_id: unknown, payload: Record<string, unknown>) => {
      updated.push(payload);
      return Promise.resolve(payload);
    }),
  };

  const regionsService = {
    findByExternalCode: jest
      .fn()
      .mockResolvedValue(
        opts.existingRegionName
          ? { id: 9, name: opts.existingRegionName }
          : null,
      ),
    create: jest.fn((payload: Record<string, unknown>) =>
      Promise.resolve({ id: 9, ...payload }),
    ),
  };

  const destinationsService = {
    findByCountryCode: jest.fn().mockResolvedValue({ id: 3, name: 'Spain' }),
    findByName: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 3 }),
    addRegion: jest.fn().mockResolvedValue(undefined),
  };

  const service = Object.create(
    EsimAccessService.prototype,
  ) as EsimAccessService;
  const internals = service as unknown as Record<string, unknown>;
  internals.plansService = plansService;
  internals.regionsService = regionsService;
  internals.destinationsService = destinationsService;
  internals.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const callProcess = (pkg: unknown) =>
    (
      service as unknown as {
        processPackage: (p: unknown) => Promise<void>;
      }
    ).processPackage(pkg);

  return { service, created, updated, callProcess, regionsService };
}

describe('eSIM Access regional plan naming', () => {
  it('should name a regional plan after its region, not the first country', async () => {
    const { created, callProcess } = makeService({
      existingRegionName: 'Europe',
    });

    await callProcess(europePackage());

    expect(created).toHaveLength(1);
    expect(created[0].name).toBe('Europe 3GB / 30day');
    // The bug this replaces.
    expect(String(created[0].name)).not.toContain('Aland Islands');
  });

  it('should follow the region name an admin set in the CMS', async () => {
    const { created, callProcess } = makeService({
      existingRegionName: 'eSIM Châu Âu',
    });

    await callProcess(europePackage());

    expect(created[0].name).toBe('eSIM Châu Âu 3GB / 30day');
  });

  it('should leave the slug untouched, so a re-sync renames instead of duplicating', async () => {
    const { created, callProcess } = makeService({
      existingRegionName: 'Europe',
    });

    await callProcess(europePackage());

    // The slug comes from the provider's location CODE, never from the country
    // name. The upsert matches existing plans by slug, so a rename must not
    // move it — otherwise every regional plan would be duplicated.
    expect(created[0].slug).toBe('eu-42-3gb-30days-fixed-es');
    expect(String(created[0].slug)).not.toContain('europe');
  });

  it('should leave single-country plans named exactly as before', async () => {
    const { created, callProcess } = makeService();

    await callProcess(spainPackage());

    expect(created[0].name).toBe('Spain 3GB / 30day');
  });
});

/**
 * eSIM Access ships two variants of many packages: one routed through Hong Kong
 * and one with a local exit IP, marked "(nonhkip)" in the package name. Apps
 * that geo-block Hong Kong routing (TikTok, ChatGPT) only work on the latter.
 *
 * Our plan name and slug are rebuilt from location + data + duration, so unless
 * the flag is captured at sync time it is gone for good and the storefront
 * cannot offer the choice (#041).
 */
describe('eSIM Access non-Hong-Kong-IP flag', () => {
  it('should flag a package the provider marked as nonhkip', async () => {
    const { created, callProcess } = makeService();

    await callProcess({
      ...spainPackage(),
      name: 'Indonesia 5GB 30Days (nonhkip)',
      slug: 'ID_5_30_nonhkip',
    });

    expect(created[0].isNonHkIp).toBe(true);
  });

  it('should not flag the ordinary variant of the same package', async () => {
    const { created, callProcess } = makeService();

    await callProcess({
      ...spainPackage(),
      name: 'Indonesia 5GB 30Days',
      slug: 'ID_5_30',
    });

    expect(created[0].isNonHkIp).toBe(false);
  });

  it('should read the slug too, not only the name', async () => {
    const { created, callProcess } = makeService();

    await callProcess({
      ...spainPackage(),
      name: 'Indonesia 5GB 30Days',
      slug: 'ID_5_30_NONHKIP',
    });

    expect(created[0].isNonHkIp).toBe(true);
  });
});
