import { SepayConfig } from './config/sepay-config.type';
import { landedOnExpectedAccount, sepayAccountFor } from './sepay-account';

/** vande-1411 #046 — SePay personal or company account per partner. */
describe('SePay cá nhân / công ty (vande-1411 #046)', () => {
  const base: SepayConfig = {
    webhookApiKey: 'k',
    accountNumber: '100000000001',
    accountName: 'CA NHAN',
    bankCode: 'VietinBank',
    memoPrefix: 'SEVQR',
    company: {
      accountNumber: '',
      accountName: '',
      bankCode: '',
      memoPrefix: '',
    },
  };
  const withCompany: SepayConfig = {
    ...base,
    company: {
      accountNumber: '200000000002',
      accountName: 'CONG TY',
      bankCode: '',
      memoPrefix: '',
    },
  };

  it('should use the company account only once it is configured', () => {
    expect(sepayAccountFor(base, 'company')).toMatchObject({
      key: 'personal',
      accountNumber: '100000000001',
      memoPrefix: 'SEVQR',
    });
    expect(sepayAccountFor(withCompany, 'company')).toEqual({
      key: 'company',
      accountNumber: '200000000002',
      accountName: 'CONG TY',
      // No bank of its own: the personal one's.
      bankCode: 'VietinBank',
      memoPrefix: '',
    });
    expect(sepayAccountFor(withCompany, 'personal').key).toBe('personal');
    expect(sepayAccountFor(withCompany, null).key).toBe('personal');
  });

  it('should hold money that landed on the other configured account', () => {
    expect(
      landedOnExpectedAccount(withCompany, 'company', '100000000001'),
    ).toBe(false);
    expect(
      landedOnExpectedAccount(withCompany, 'personal', '200000000002'),
    ).toBe(false);
    expect(
      landedOnExpectedAccount(withCompany, 'company', '200000000002'),
    ).toBe(true);
  });

  it('should let through what it cannot tell apart, as before', () => {
    // No number, an unknown (virtual) number, an order from before #046, or
    // no company account at all.
    expect(landedOnExpectedAccount(withCompany, 'company', undefined)).toBe(
      true,
    );
    expect(landedOnExpectedAccount(withCompany, 'personal', 'VA12345')).toBe(
      true,
    );
    expect(landedOnExpectedAccount(withCompany, null, '200000000002')).toBe(
      true,
    );
    expect(landedOnExpectedAccount(base, 'personal', '999')).toBe(true);
  });
});
