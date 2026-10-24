import { microEsimAllowance } from './microesim-plan-type';
import { isCountryCodeList } from '../catalogue-naming';

/**
 * Loại gói MicroEsim (vande #012). Các ví dụ là gói thật trong catalogue
 * MicroEsim (đọc 25/10/2026).
 */
describe('MicroEsim plan type (vande #012)', () => {
  const t = (data: string, rule: string, name = '') =>
    microEsimAllowance({ data, rule_desc: rule, channel_dataplan_name: name });

  it('should file a daily quota as daily, not fixed', () => {
    expect(
      t('Daily1GB', 'unlimited 128kbps', 'Singapore-Daily1GB-7-A1'),
    ).toEqual({
      type: 'daily',
      dataMb: 1024,
      fupSpeed: '128kbps',
    });
    expect(t('Daily5GB', 'terminate', 'Vietnam-Local-Daily5GB-30-D0')).toEqual({
      type: 'daily',
      dataMb: 5120,
      fupSpeed: 'Terminate',
    });
  });

  it('should call a daily quota slowed to more than 1 Mbps unlimited', () => {
    expect(
      t('Daily1GB', 'unlimited 5mbps', 'Singapore-Daily1GB-15-5mbps-A2').type,
    ).toBe('unlimited');
    expect(t('Daily1GB', 'unlimited 1mbps').type).toBe('unlimited-reduce');
  });

  it('should keep a total quota fixed, with its after-quota speed', () => {
    expect(
      t('Total20GB', 'terminate', 'UK+EU45 Local-Total20GB-30-A0'),
    ).toEqual({
      type: 'fixed',
      dataMb: 20480,
      fupSpeed: 'Terminate',
    });
  });

  it('should read Unlimited plans', () => {
    expect(t('Unlimited', 'unlimited')).toEqual({
      type: 'unlimited',
      dataMb: 0,
      fupSpeed: null,
    });
    expect(t('Unlimited', 'unlimited 10mbps').type).toBe('unlimited');
    expect(t('Unlimited', 'unlimited 512kbps').type).toBe('unlimited-reduce');
  });

  it('should recognise code-list region names with subdivision codes', () => {
    expect(isCountryCodeList('AT,BE,BG,PT-20,PT-30,YT')).toBe(true);
    expect(isCountryCodeList('AL,DZ,US,US-HI,VI')).toBe(true);
    expect(isCountryCodeList('UK+EU45 Local')).toBe(false);
    expect(isCountryCodeList('Global 108')).toBe(false);
  });
});
