import { MailService } from './mail.service';
import { readPartnerBrand } from '../partners/partner-brand';

/**
 * vande-2011 #030 — "Hướng dẫn cài đặt eSIM" in the eSIM email. The block was
 * built for partners (doitac-1410 #044) and left out of esim.vn's own email.
 */
describe('eSIM email: install guide (vande-2011 #030)', () => {
  const service = Object.create(MailService.prototype) as {
    esimBrandContext: (
      brand: ReturnType<typeof readPartnerBrand> | undefined,
      usageCheckUrl: string,
      frontendDomain: string,
    ) => { installGuideUrl: string };
  };

  it("should link the guide in esim.vn's own email", () => {
    expect(
      service.esimBrandContext(undefined, '', 'https://esim.vn/')
        .installGuideUrl,
    ).toBe('https://esim.vn/huong-dan-cai-dat-esim');
  });

  it('should keep it for a partner who shows it, and drop it for one who does not', () => {
    const on = readPartnerBrand({ displayName: 'A' });
    const off = readPartnerBrand({ displayName: 'B', showInstallGuide: false });
    expect(
      service.esimBrandContext(on, '', 'https://esim.vn').installGuideUrl,
    ).toBe('https://esim.vn/huong-dan-cai-dat-esim');
    expect(
      service.esimBrandContext(off, '', 'https://esim.vn').installGuideUrl,
    ).toBe('');
  });
});
