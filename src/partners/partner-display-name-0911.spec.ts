import { partnerDisplayName } from './partners.service';

/** doitac-0911 #012 — a company partner is called by the company's name. */
describe('partnerDisplayName (doitac-0911 #012)', () => {
  it('should use the company name for a company', () => {
    expect(
      partnerDisplayName({
        legalType: 'company',
        companyName: 'Hoàng Hà Mobile',
        contactName: 'Phạm Hồng Thái',
      }),
    ).toBe('Hoàng Hà Mobile');
  });

  it('should use the person for an individual, even with a company typed', () => {
    expect(
      partnerDisplayName({
        legalType: 'individual',
        companyName: 'Shop ABC',
        contactName: 'Nguyễn Văn A',
      }),
    ).toBe('Nguyễn Văn A');
  });

  it('should fall back to the contact when the company name is blank', () => {
    expect(
      partnerDisplayName({
        legalType: 'company',
        companyName: '  ',
        contactName: 'Lại Hà',
      }),
    ).toBe('Lại Hà');
  });
});
