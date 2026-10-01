import { UsersRelationalRepository } from './infrastructure/persistence/relational/repositories/user.repository';
import { WalletStatusEnum } from '../wallets/wallets.enum';

/**
 * #038 — Số dư eXU and Thời hạn dùng eXU on the admin customer list.
 *
 * The balance has to mean the same thing the customer sees in their own wallet,
 * which is NOT `user_wallet.balanceVnd`: a locked wallet, an expired balance and
 * eXu already held against an unpaid order all spend as zero. The figures are
 * rolled up in one set-based query, because a per-row lookup on a 50-row page
 * would be 50 transactions.
 */
describe('eXu columns on the admin user list (#038)', () => {
  type WalletRow = {
    userId: number;
    balance: string;
    held: string;
    available: string;
    status: string;
    expiresAt: Date | null;
  };

  /** Runs the repository against canned SQL results and returns the users. */
  async function run(walletRows: WalletRow[], userIds = [7]) {
    const entities = userIds.map((id) => ({
      id,
      email: `u${id}@esim.vn`,
      lifetimeSpendVnd: 0,
      tierOverride: null,
    }));

    const query = jest.fn((sql: string) => {
      if (sql.includes('user_referral_profile')) return Promise.resolve([]);
      if (sql.includes('FROM "order"')) return Promise.resolve([]);
      if (sql.includes('user_wallet')) return Promise.resolve(walletRows);
      return Promise.resolve([]);
    });

    const repo = new UsersRelationalRepository({
      findAndCount: jest.fn().mockResolvedValue([entities, entities.length]),
      manager: { query },
    } as never);

    const [users] = await repo.findManyWithPagination({
      filterOptions: null,
      sortOptions: null,
      paginationOptions: { page: 1, limit: 10 },
    });

    return { users, query };
  }

  function walletRow(over: Partial<WalletRow> = {}): WalletRow {
    return {
      userId: 7,
      balance: '70000',
      held: '20000',
      available: '50000',
      status: WalletStatusEnum.ACTIVE,
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      ...over,
    };
  }

  it('should reports the spendable balance, the gross balance and what is held', async () => {
    const { users } = await run([walletRow()]);

    expect(users[0].exuBalanceVnd).toBe(50000);
    expect(users[0].exuGrossBalanceVnd).toBe(70000);
    expect(users[0].exuHeldVnd).toBe(20000);
  });

  it('should carries the expiry date through as a Date', async () => {
    const { users } = await run([walletRow()]);

    expect(users[0].exuExpiresAt).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    expect(users[0].exuWalletStatus).toBe(WalletStatusEnum.ACTIVE);
  });

  it('should keeps the gross balance visible when nothing is spendable', async () => {
    // An expired or locked wallet still has money in the ledger; showing 0 with
    // no explanation makes it look like the eXu was lost.
    const { users } = await run([
      walletRow({ available: '0', held: '0', status: 'locked' }),
    ]);

    expect(users[0].exuBalanceVnd).toBe(0);
    expect(users[0].exuGrossBalanceVnd).toBe(70000);
    expect(users[0].exuWalletStatus).toBe('locked');
  });

  it('should shows 0 rather than null for a customer who never earned eXu', async () => {
    // No wallet row is not missing data — it is a zero balance.
    const { users } = await run([]);

    expect(users[0].exuBalanceVnd).toBe(0);
    expect(users[0].exuGrossBalanceVnd).toBe(0);
    expect(users[0].exuHeldVnd).toBe(0);
    expect(users[0].exuExpiresAt).toBeNull();
    expect(users[0].exuWalletStatus).toBeNull();
  });

  it('should matches each wallet to its own user', async () => {
    // One query for the page means the rows come back unordered; keying them by
    // userId is what stops one customer showing another's balance.
    const { users } = await run(
      [
        walletRow({ userId: 9, balance: '9000', available: '9000', held: '0' }),
        walletRow({ userId: 7, balance: '7000', available: '7000', held: '0' }),
      ],
      [7, 9],
    );

    const byId = new Map(users.map((u) => [Number(u.id), u.exuBalanceVnd]));
    expect(byId.get(7)).toBe(7000);
    expect(byId.get(9)).toBe(9000);
  });

  it('should asks the database once for the whole page, not once per customer', async () => {
    const { query } = await run(
      [walletRow({ userId: 7 }), walletRow({ userId: 9 })],
      [7, 9],
    );

    const walletCalls = query.mock.calls.filter(([sql]) =>
      String(sql).includes('user_wallet'),
    );
    expect(walletCalls).toHaveLength(1);
  });

  it('should excludes expired holds from the held figure', async () => {
    // A hold that timed out was released back to the customer, so it must not
    // keep suppressing their balance.
    const { query } = await run([walletRow()]);

    const [sql] = query.mock.calls.find(([s]) =>
      String(s).includes('wallet_hold'),
    )!;
    expect(String(sql)).toContain('"expiresAt" > NOW()');
  });

  it('should zeroes the spendable balance once the expiry has passed', async () => {
    const { query } = await run([walletRow()]);

    const [sql] = query.mock.calls.find(([s]) =>
      String(s).includes('user_wallet'),
    )!;
    // Mirrors getAvailableBalanceWithManager: status first, then expiry.
    expect(String(sql)).toContain('w."expiresAt" < NOW() THEN 0');
    expect(String(sql)).toContain('w."status" <> $2 THEN 0');
  });
});
