import Handlebars from 'handlebars';
import {
  isOwnFileUrl,
  readPartnerBrand,
  sanitizeBrandInput,
} from './partner-brand';
import { STEPS } from '../database/migrations/1798200000000-PartnerBrandEsimEmail';
import {
  loadPartnerQrLogo,
  resetPartnerLogoCache,
} from '../esims/partner-qr-logo';

describe('Partner brand (doitac-1410 #044)', () => {
  it('should fill every default when nothing was set', () => {
    expect(readPartnerBrand(null)).toEqual({
      displayName: '',
      logoUrl: '',
      logoPosition: 'center',
      tagline: '',
      website: '',
      supportEmail: '',
      primaryColor: '#000000',
      showUsageCheck: true,
      showInstallGuide: true,
    });
  });

  it('should keep a valid brand and drop what the email cannot render', () => {
    expect(
      readPartnerBrand({
        displayName: '  SIM Số Đẹp ',
        logoUrl: 'javascript:alert(1)',
        logoPosition: 'diagonal',
        website: 'simsodep.vn',
        supportEmail: 'ho-tro@simsodep.vn',
        primaryColor: 'red',
        showUsageCheck: false,
      }),
    ).toMatchObject({
      displayName: 'SIM Số Đẹp',
      logoUrl: '',
      logoPosition: 'center',
      website: 'https://simsodep.vn/',
      supportEmail: 'ho-tro@simsodep.vn',
      primaryColor: '#000000',
      showUsageCheck: false,
      showInstallGuide: true,
    });
  });

  it('should refuse an invalid website, email or colour on save', () => {
    expect(() => sanitizeBrandInput({ supportEmail: 'abc' })).toThrow(
      'Email hỗ trợ không hợp lệ.',
    );
    expect(() => sanitizeBrandInput({ primaryColor: '#12' })).toThrow(
      'Màu chủ đạo không hợp lệ.',
    );
    expect(() => sanitizeBrandInput({ website: 'http://' })).toThrow(
      'Trang web chính thức không hợp lệ.',
    );
  });

  it('should only treat our own uploads as safe to download', () => {
    const opts = {
      backendDomain: 'https://beta-api.esim.vn',
      s3Bucket: 'esimvn',
      s3Region: 'ap-southeast-1',
    };
    expect(
      isOwnFileUrl('https://beta-api.esim.vn/api/v1/files/abc.png', opts),
    ).toBe(true);
    expect(
      isOwnFileUrl(
        'https://esimvn.s3.ap-southeast-1.amazonaws.com/abc.png?X-Amz=1',
        opts,
      ),
    ).toBe(true);
    expect(isOwnFileUrl('https://evil.example/logo.png', opts)).toBe(false);
    expect(isOwnFileUrl('http://169.254.169.254/latest/meta-data', opts)).toBe(
      false,
    );
    // Same host, but not a stored file.
    expect(isOwnFileUrl('https://beta-api.esim.vn/api/v1/users', opts)).toBe(
      false,
    );
  });
});

describe('Partner logo in the QR code (doitac-1410 #044)', () => {
  beforeEach(() => resetPartnerLogoCache());
  const OPTS = { backendDomain: 'http://localhost:3001' };
  const dataSource = (logoUrl: string) =>
    ({
      query: jest.fn().mockResolvedValue([{ brandInfo: { logoUrl } }]),
    }) as never;

  it('should download a logo our upload stored', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Map([
        ['content-type', 'image/png'],
        ['content-length', '4'],
      ]),
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer),
    });
    const logo = await loadPartnerQrLogo(
      dataSource('http://localhost:3001/api/v1/files/a.png'),
      7,
      OPTS,
      fetchImpl as never,
    );
    expect(logo?.length).toBe(4);
  });

  it('should never download a logo from another host', async () => {
    const fetchImpl = jest.fn();
    await expect(
      loadPartnerQrLogo(
        dataSource('http://10.0.0.5/admin.png'),
        7,
        OPTS,
        fetchImpl as never,
      ),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('should fall back when the file is not an image', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'text/html']]),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
    });
    await expect(
      loadPartnerQrLogo(
        dataSource('http://localhost:3001/api/v1/files/a.png'),
        7,
        OPTS,
        fetchImpl as never,
      ),
    ).resolves.toBeNull();
  });
});

describe('eSIM email template with a partner brand (doitac-1410 #044)', () => {
  // The four pieces of the stock template the migration rewrites.
  const STOCK = STEPS.map((s) => s.from).join('\n');
  const BRANDED = STEPS.reduce((html, s) => html.replace(s.from, s.to), STOCK);
  const render = (ctx: Record<string, unknown>) =>
    Handlebars.compile(BRANDED, { strict: false })({
      app_name: 'esim.vn',
      ...ctx,
    });

  it('should render esim.vn orders exactly as before', () => {
    const stock = Handlebars.compile(STOCK)({ app_name: 'esim.vn' });
    // Same markup; only the whitespace around the new block may differ.
    const squash = (html: string) => html.replace(/\s+/g, ' ').trim();
    expect(
      squash(
        render({
          logoAlign: 'center',
          brandColor: '#000000',
          installGuideUrl: '',
          partnerFooter: '',
        }),
      ),
    ).toBe(squash(stock));
  });

  it("should carry the partner's position, colour, guide and footer", () => {
    const html = render({
      logoAlign: 'left',
      brandColor: '#ff6600',
      installGuideUrl: 'https://esim.vn/huong-dan-cai-dat-esim',
      partnerFooter: 'true',
      partnerName: 'SIM Số Đẹp',
      partnerTagline: 'eSIM giá tốt',
      partnerWebsite: 'https://simsodep.vn/',
      partnerSupportEmail: 'ho-tro@simsodep.vn',
    });
    expect(html).toContain('text-align:left');
    expect(html).toContain('background:#ff6600;color:#ffffff');
    expect(html).toContain('Hướng dẫn cài đặt eSIM');
    expect(html).toContain('SIM Số Đẹp');
    expect(html).toContain('mailto:ho-tro@simsodep.vn');
    expect(html).not.toContain('If you did not make this purchase');
  });
});

describe('PartnerBrandEsimEmail migration markers (doitac-1410 #044)', () => {
  it('should find its own marker in every rewritten piece, so a re-run is a no-op', () => {
    for (const step of STEPS) {
      expect(step.to).toContain(step.marker);
      expect(step.from).not.toContain(step.marker);
    }
  });
});
