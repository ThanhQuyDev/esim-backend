import { emailDataText, emailPlanName } from './mail.service';

describe('eSIM email plan lines (#025, test round 4)', () => {
  it('should name the plan like the CMS, minutes and SMS spelled out', () => {
    expect(emailPlanName('United States 2GB / 15day', 20, 20)).toBe(
      'United States 2GB / 15day - 20Mins - 20SMS',
    );
    expect(emailPlanName('Japan 1GB / 7day', null, null)).toBe(
      'Japan 1GB / 7day',
    );
  });

  it('should write the data line per kind of plan', () => {
    expect(emailDataText({ dataMb: 2048, type: 'daily' })).toBe('2GB / ngày');
    expect(
      emailDataText({ dataMb: 1024, durationDays: 7, type: 'fixed' }),
    ).toBe('1GB - 7 ngày');
    expect(emailDataText({ dataMb: 0, type: 'unlimited' })).toBe(
      'Không giới hạn',
    );
    expect(emailDataText(null)).toBe('');
  });
});
