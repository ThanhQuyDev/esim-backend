import { partnerLastActivity } from './partners.service';
import { UserMapper } from '../users/infrastructure/persistence/relational/mappers/user.mapper';

/**
 * doitac-3010 #035 — "Hoạt động gần nhất" read "Chưa đăng nhập" for a partner
 * who had signed in and changed their password: the sign-in time never
 * reached the database, and nothing else they did counted either.
 */
describe('Partner last activity (doitac-3010 #035)', () => {
  it('should write the sign-in time to the database', () => {
    const at = new Date('2026-11-01T02:00:00Z');
    const entity = UserMapper.toPersistence({
      id: 7,
      email: 'doitac@example.com',
      lastLoginAt: at,
    } as never);
    expect(entity.lastLoginAt).toEqual(at);
  });

  it('should leave the sign-in time alone when an update does not carry it', () => {
    const entity = UserMapper.toPersistence({
      id: 7,
      email: 'doitac@example.com',
    } as never);
    expect('lastLoginAt' in entity && entity.lastLoginAt !== undefined).toBe(
      false,
    );
  });

  it('should take the latest of the sign-in and what the partner did', () => {
    expect(
      partnerLastActivity({
        lastLoginAt: '2026-10-30T01:00:00Z',
        lastLinkAt: '2026-10-31T09:00:00Z',
        lastPayoutAt: '2026-10-29T09:00:00Z',
        lastTicketAt: null,
      }),
    ).toEqual({
      lastActivityAt: new Date('2026-10-31T09:00:00Z'),
      lastActivityLabel: 'Thao tác link tiếp thị',
    });
  });

  it("should count a distribution partner's purchase and deposit", () => {
    expect(
      partnerLastActivity({
        lastLoginAt: '2026-10-30T01:00:00Z',
        lastDepositAt: '2026-10-31T01:00:00Z',
        lastPurchaseAt: '2026-11-01T01:00:00Z',
      }).lastActivityLabel,
    ).toBe('Đặt mua eSIM');
  });

  it('should say nothing for a partner who never did anything', () => {
    expect(partnerLastActivity({})).toEqual({
      lastActivityAt: null,
      lastActivityLabel: null,
    });
    expect(partnerLastActivity(undefined).lastActivityAt).toBeNull();
  });
});
