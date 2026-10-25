import { payoutIdFromCode, payoutRequestCode } from './partners.service';

/** "Mã yêu cầu" of a withdrawal on "Tài chính" (vande #067). */
describe('payout request code (vande #067)', () => {
  it('should write RT and the id in six digits', () => {
    expect(payoutRequestCode(123)).toBe('RT000123');
    expect(payoutRequestCode(1234567)).toBe('RT1234567');
  });

  it('should read the code back however it is typed', () => {
    expect(payoutIdFromCode('RT000123')).toBe(123);
    expect(payoutIdFromCode('rt-123')).toBe(123);
    expect(payoutIdFromCode(' RT123 ')).toBe(123);
  });

  it('should not take a name, an email or a deposit code for one', () => {
    expect(payoutIdFromCode('Trang')).toBeNull();
    expect(payoutIdFromCode('ESIM7K2M9P')).toBeNull();
    expect(payoutIdFromCode('123')).toBeNull();
  });
});
