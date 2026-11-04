import { HK_TWIN_SLUG_SUFFIX, pairNonhkipVariants } from './esimaccess.service';
import { EsimAccessPackage } from './esimaccess-api.types';

function pkg(over: Partial<EsimAccessPackage>): EsimAccessPackage {
  return {
    packageCode: 'X',
    slug: 'CN_1_Daily',
    name: 'China 1GB/Day FUP1Mbps',
    price: 8000,
    locationCode: 'CN',
    location: 'CN',
    volume: 1073741824,
    duration: 1,
    dataType: 2,
    fupPolicy: '1 Mbps',
    ...over,
  } as EsimAccessPackage;
}

/**
 * vande #017 — the regular esimaccess package was dropped whenever a
 * "(nonhkip)" twin existed, so its cheaper price never entered the comparison.
 */
describe('esimaccess regular + nonhkip twins (vande #017)', () => {
  it('should keep both the regular and the nonhkip package', () => {
    const regular = pkg({ packageCode: 'PVG1G9ZU2', price: 8000 });
    const nonhkip = pkg({
      packageCode: 'P03XQE2SQ',
      name: 'China 1GB/Day FUP1Mbps (nonhkip)',
      slug: 'CN_1_Daily_nonhkip',
      price: 9200,
    });

    const result = pairNonhkipVariants([regular, nonhkip]);

    expect(result.map((r) => r.pkg.packageCode).sort()).toEqual([
      'P03XQE2SQ',
      'PVG1G9ZU2',
    ]);
    // The nonhkip plan keeps the slug it always had; its twin gets a suffix
    // so the two never collide on the unique slug.
    expect(result.find((r) => r.pkg === nonhkip)?.slugSuffix).toBe('');
    expect(result.find((r) => r.pkg === regular)?.slugSuffix).toBe(
      HK_TWIN_SLUG_SUFFIX,
    );
  });

  it('should leave a package without a twin on its usual slug', () => {
    const result = pairNonhkipVariants([
      pkg({ packageCode: 'A', locationCode: 'JP', location: 'JP' }),
      pkg({
        packageCode: 'B',
        locationCode: 'KR',
        location: 'KR',
        name: 'Korea 1GB/Day (nonhkip)',
      }),
    ]);
    expect(result.map((r) => r.slugSuffix)).toEqual(['', '']);
  });

  it('should still drop exact duplicates that are not a nonhkip pair', () => {
    const result = pairNonhkipVariants([
      pkg({ packageCode: 'A' }),
      pkg({ packageCode: 'B' }),
    ]);
    expect(result.map((r) => r.pkg.packageCode)).toEqual(['A']);
  });

  it('should not pair plans with a different speed after the cap', () => {
    const result = pairNonhkipVariants([
      pkg({ packageCode: 'A', fupPolicy: '1 Mbps' }),
      pkg({ packageCode: 'B', fupPolicy: '512 Kbps', name: 'x (nonhkip)' }),
    ]);
    expect(result.map((r) => r.slugSuffix)).toEqual(['', '']);
  });
});

describe('Gói IP theo nước của eSIM Access (vande-0411 #031)', () => {
  const pack = (over: Record<string, unknown>) =>
    ({
      locationCode: 'AU',
      volume: 1073741824,
      duration: 1,
      dataType: 2,
      fupPolicy: '1 Mbps',
      ...over,
    }) as never;
  const regular = pack({
    packageCode: 'P07T5HKJD',
    name: 'Australia 1GB/Day FUP1Mbps',
    slug: 'AU_1_Daily_1Mbps',
  });
  const nonhkip = pack({
    packageCode: 'PNON',
    name: 'Australia 1GB/Day FUP1Mbps (nonhkip)',
    slug: 'AU_1_Daily_1Mbps_nonhkip',
  });
  const auip = pack({
    packageCode: 'PR1JV40NN',
    name: 'Australia 1GB/Day FUP1Mbps (AUIP)',
    slug: 'AU_1_Daily_1Mbps_auip',
  });
  const codes = (
    list: { pkg: { packageCode: string }; slugSuffix: string }[],
  ) => list.map((row) => [row.pkg.packageCode, row.slugSuffix]);

  it('should keep the regular, nonhkip and country-IP packages apart', () => {
    expect(codes(pairNonhkipVariants([auip, regular, nonhkip]))).toEqual([
      ['PNON', ''],
      ['P07T5HKJD', HK_TWIN_SLUG_SUFFIX],
      ['PR1JV40NN', '-auip'],
    ]);
  });

  it('should not take a country-IP package for the regular one', () => {
    expect(codes(pairNonhkipVariants([auip, regular]))).toEqual([
      ['P07T5HKJD', ''],
      ['PR1JV40NN', '-auip'],
    ]);
  });

  it('should keep a package with its own slug on the same specs', () => {
    const plain = pack({
      packageCode: 'FR1',
      slug: 'FR_3_Daily',
      name: 'France 3GB/Day',
    });
    const other = pack({
      packageCode: 'FR2',
      slug: 'FR_3_Daily_1Mbps',
      name: 'France 3GB/Day FUP1Mbps',
    });

    expect(codes(pairNonhkipVariants([plain, other]))).toEqual([
      ['FR1', ''],
      ['FR2', '-fr-3-daily-1mbps'],
    ]);
  });

  it('should keep a country-IP package with nothing beside it', () => {
    expect(codes(pairNonhkipVariants([auip]))).toEqual([
      ['PR1JV40NN', '-auip'],
    ]);
  });
});
