import {
  isCountryCodeList,
  networkSpeed,
  shortRegionName,
  slugify,
  uniqueOperators,
} from './catalogue-naming';

describe('catalogue naming (#003, test round 4)', () => {
  it('should name a region after the supplier pack, not its country codes', () => {
    expect(shortRegionName('Global 126-Local-Total50GB-30-E0')).toBe(
      'Global 126',
    );
    expect(shortRegionName('US/CA/MX-unlimited-3-A0')).toBe('US/CA/MX');
    expect(shortRegionName('NA,SA,CB 23-Total30GB-25-A0')).toBe('NA,SA,CB 23');
  });

  it('should build the short slug the customer asked for', () => {
    expect(`${slugify('Global 126')}-50gb-30days-fixed-mi`).toBe(
      'global-126-50gb-30days-fixed-mi',
    );
    expect(slugify('Greater China(CHMT)(T+C)')).toBe('greater-china-chmt-t-c');
  });

  it('should recognise a raw country-code region name', () => {
    expect(isCountryCodeList('AE,AG,AI,AL')).toBe(true);
    expect(isCountryCodeList('Global 126')).toBe(false);
    expect(isCountryCodeList('CN')).toBe(false);
  });

  it('should drop the Auto placeholders and repeated carriers', () => {
    expect(uniqueOperators(['Auto', 'Auto connect', 'auto'])).toBeNull();
    expect(uniqueOperators(['Claro', 'TIM', 'Claro', ' Auto '])).toBe(
      'Claro, TIM',
    );
  });

  it('should read the network generations', () => {
    expect(networkSpeed(['[4G;LTE]', '[5G]'])).toBe('4G/5G');
    expect(networkSpeed(['5G', '4G', '3G'])).toBe('3G/4G/5G');
    expect(networkSpeed(['', null])).toBeNull();
  });
});
