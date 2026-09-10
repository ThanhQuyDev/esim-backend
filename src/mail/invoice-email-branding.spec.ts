import { readFileSync } from 'fs';
import { join } from 'path';
import * as Handlebars from 'handlebars';
import {
  LOGO_HEADER,
  NEW_EMAIL,
  OLD_EMAIL,
  SUPPORT_PLACEHOLDER,
  TEXT_HEADER,
} from '../database/migrations/1788025100000-FixInvoiceEmailBranding';
import { BRAND_LOGO_URL, SUPPORT_EMAIL } from './mail-branding';

/**
 * Invoice-request email branding (#079).
 *
 * The migration patches a stored template with two string replacements, so the
 * strings it looks for have to match the seeded HTML exactly — a typo would
 * leave production with the old address and no logo, silently. These tests
 * apply the same replacements to the real seeded template and check the result
 * renders the way the email is meant to look.
 */
describe('invoice email branding', () => {
  const seedPath = join(
    __dirname,
    '..',
    'database',
    'migrations',
    '1778900000000-SeedInvoiceIssuedEmailTemplate.ts',
  );
  const seedSource = readFileSync(seedPath, 'utf8');

  /** The template literal the seed migration inserts. */
  const seededTemplate = (() => {
    const match = seedSource.match(
      /const DEFAULT_INVOICE_ISSUED_TEMPLATE = `([\s\S]*?)`;/,
    );
    if (!match) throw new Error('seeded invoice template not found');
    return match[1];
  })();

  /** What the migration's SQL does, in JS. */
  const patched = seededTemplate
    .split(TEXT_HEADER)
    .join(LOGO_HEADER)
    .split(OLD_EMAIL)
    .join(SUPPORT_PLACEHOLDER);

  it('should find the exact header the seed wrote', () => {
    expect(seededTemplate).toContain(TEXT_HEADER);
    expect(patched).toContain(LOGO_HEADER);
    expect(patched).not.toContain(TEXT_HEADER);
  });

  it('should find the old support address the seed wrote', () => {
    expect(seededTemplate).toContain(OLD_EMAIL);
    expect(patched).not.toContain(OLD_EMAIL);
  });

  it('should render the logo and the address support actually reads', () => {
    const html = Handlebars.compile(patched, { strict: false })({
      orderNumber: 'ES123',
      companyName: 'Công ty ABC',
      taxCode: '0101234567',
      address: '1 Trần Hưng Đạo, Hà Nội',
      totalAmountFormatted: '1.200.000',
      app_name: 'esim.vn',
      logoUrl: BRAND_LOGO_URL,
      supportEmail: SUPPORT_EMAIL,
    });

    expect(html).toContain(`<img src="${BRAND_LOGO_URL}"`);
    expect(html).toContain(`mailto:${NEW_EMAIL}`);
    expect(html).toContain(NEW_EMAIL);
    expect(html).not.toContain(OLD_EMAIL);
    // The order details must survive the patch untouched.
    expect(html).toContain('ES123');
    expect(html).toContain('1.200.000');
  });

  it('should fall back to the brand name when no logo url is given', () => {
    const html = Handlebars.compile(patched, { strict: false })({
      app_name: 'esim.vn',
      supportEmail: SUPPORT_EMAIL,
    });

    expect(html).not.toContain('<img src=""');
    expect(html).toContain('esim.vn');
  });

  it('should keep the support address in one place in code', () => {
    expect(SUPPORT_EMAIL).toBe(NEW_EMAIL);
    expect(SUPPORT_EMAIL).not.toBe(OLD_EMAIL);
  });

  it('should leave an edited template alone when the header no longer matches', () => {
    // An admin rewrote the header: the replacement finds nothing and the rest
    // of the migration (the address swap) still applies.
    const edited = seededTemplate
      .split(TEXT_HEADER)
      .join('          <tr><td>Custom header</td></tr>');

    const result = edited
      .split(TEXT_HEADER)
      .join(LOGO_HEADER)
      .split(OLD_EMAIL)
      .join(SUPPORT_PLACEHOLDER);

    expect(result).toContain('Custom header');
    expect(result).not.toContain(OLD_EMAIL);
    expect(result).toContain(SUPPORT_PLACEHOLDER);
  });
});
