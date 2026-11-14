import { customerLastActivity } from './customer-last-activity';

/** vande-1411 #043 — "Hoạt động gần nhất" on the customer list. */
describe('customerLastActivity', () => {
  it('should pick the newest act and name it', () => {
    expect(
      customerLastActivity({
        lastLoginAt: '2026-11-10T08:00:00Z',
        lastOrderAt: new Date('2026-11-12T09:30:00Z'),
        lastTicketAt: null,
        lastChatAt: '2026-11-11T00:00:00Z',
      }),
    ).toEqual({
      lastActivityAt: new Date('2026-11-12T09:30:00Z'),
      lastActivityLabel: 'Đặt hàng',
    });
  });

  it('should say nothing when there is nothing', () => {
    expect(customerLastActivity(undefined)).toEqual({
      lastActivityAt: null,
      lastActivityLabel: null,
    });
    expect(customerLastActivity({ lastLoginAt: 'not a date' })).toEqual({
      lastActivityAt: null,
      lastActivityLabel: null,
    });
  });
});
