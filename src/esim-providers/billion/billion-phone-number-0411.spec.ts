import { billionPhoneNumber } from './billion.service';

describe('Số điện thoại eSIM Billion (vande-0411 #033)', () => {
  it('should take the number Billion sends', () => {
    expect(billionPhoneNumber('+85212345678')).toBe('+85212345678');
  });

  it('should not read an empty msisdn as a number', () => {
    expect(billionPhoneNumber('')).toBeNull();
    expect(billionPhoneNumber('  ')).toBeNull();
    expect(billionPhoneNumber(undefined)).toBeNull();
  });

  it('should keep a known number when Billion sends none', () => {
    expect(billionPhoneNumber('', '+85212345678')).toBe('+85212345678');
  });
});
