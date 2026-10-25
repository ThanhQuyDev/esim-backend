import { payoutIdFromCode, payoutRequestCode } from './partners.service';

/** "Mã yêu cầu" of a withdrawal on "Tài chính" (vande #067). */
describe('payout request code (vande #067)', () => {
  it('should write the WD- code the partner reads in their portal', () => {
    expect(payoutRequestCode(123)).toBe('WD-000123');
    expect(payoutRequestCode(1234567)).toBe('WD-1234567');
  });

  it('should read the code back however it is typed', () => {
    expect(payoutIdFromCode('WD-000123')).toBe(123);
    expect(payoutIdFromCode('wd-123')).toBe(123);
    expect(payoutIdFromCode(' WD000123 ')).toBe(123);
  });

  it('should not take a name, an email or a deposit code for one', () => {
    expect(payoutIdFromCode('Trang')).toBeNull();
    expect(payoutIdFromCode('ESIM7K2M9P')).toBeNull();
    expect(payoutIdFromCode('123')).toBeNull();
  });
});
