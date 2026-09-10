import { UsersRelationalRepository } from './infrastructure/persistence/relational/repositories/user.repository';

/**
 * Admin customer list (#056): each row must carry the customer's own referral
 * code and how many orders they have actually paid for.
 *
 * Neither figure lives on the user table — the code is in
 * `user_referral_profile`, the count has to be aggregated from orders — so the
 * listing enriches the page after fetching it. The things that can silently go
 * wrong: counting refunded orders as purchases, and running one query per row.
 */

interface CapturedQuery {
  sql: string;
  params: unknown[];
}

function makeRepository(opts: {
  users: { id: number }[];
  referralRows?: { userId: number; code: string }[];
  orderRows?: { userId: number; count: string }[];
}) {
  const queries: CapturedQuery[] = [];

  const entities = opts.users.map((user) => ({
    ...user,
    email: `user${user.id}@test.vn`,
    provider: 'email',
    socialId: null,
    firstName: 'Test',
    lastName: `User ${user.id}`,
    phoneNumber: null,
    lifetimeSpendVnd: 0,
    tierOverride: null,
    tierOverrideReason: null,
    photo: null,
    authorProfile: null,
    role: { id: 2, name: 'user' },
    status: { id: 1, name: 'active' },
  }));

  const repo = new UsersRelationalRepository({
    findAndCount: jest.fn().mockResolvedValue([entities, entities.length]),
    manager: {
      query: jest.fn((sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return Promise.resolve(
          sql.includes('user_referral_profile')
            ? (opts.referralRows ?? [])
            : (opts.orderRows ?? []),
        );
      }),
    },
  } as never);

  return { repo, queries };
}

const PAGINATION = { page: 1, limit: 10 };

async function listUsers(opts: Parameters<typeof makeRepository>[0]) {
  const { repo, queries } = makeRepository(opts);
  const [users] = await repo.findManyWithPagination({
    filterOptions: null,
    sortOptions: null,
    paginationOptions: PAGINATION,
  });
  return { users, queries };
}

describe('Customer list summary', () => {
  it('should attach each customer their own referral code and paid order count', async () => {
    const { users } = await listUsers({
      users: [{ id: 7 }, { id: 9 }],
      referralRows: [{ userId: 7, code: 'ESIM8F2K' }],
      orderRows: [
        { userId: 7, count: '3' },
        { userId: 9, count: '1' },
      ],
    });

    expect(users[0]).toMatchObject({
      id: 7,
      referralCode: 'ESIM8F2K',
      paidOrderCount: 3,
    });
    expect(users[1]).toMatchObject({ id: 9, paidOrderCount: 1 });
  });

  it('should say "no code" rather than borrowing another customer\'s', async () => {
    // A code only exists once the customer has opened their referral page.
    const { users } = await listUsers({
      users: [{ id: 9 }],
      referralRows: [{ userId: 7, code: 'ESIM8F2K' }],
    });

    expect(users[0].referralCode).toBeNull();
  });

  it('should report zero orders instead of leaving the cell undefined', async () => {
    const { users } = await listUsers({ users: [{ id: 9 }], orderRows: [] });

    expect(users[0].paidOrderCount).toBe(0);
  });

  it('should count only paid orders, and only live ones', async () => {
    const { queries } = await listUsers({ users: [{ id: 7 }] });
    const orderQuery = queries.find((q) => q.sql.includes('FROM "order"'))!;

    expect(orderQuery.sql).toContain('COUNT(*)');
    // The same status set the revenue dashboards use: a refunded order is not a
    // completed purchase.
    expect(orderQuery.params[1]).toEqual(['paid']);
    expect(orderQuery.sql).toContain('"deletedAt" IS NULL');
  });

  it('should ask only for active referral codes', async () => {
    const { queries } = await listUsers({ users: [{ id: 7 }] });
    const referralQuery = queries.find((q) =>
      q.sql.includes('user_referral_profile'),
    )!;

    expect(referralQuery.sql).toContain('"isActive" = true');
    expect(referralQuery.params[0]).toEqual([7]);
  });

  it('should use two set-based queries, never one per row', async () => {
    const { queries } = await listUsers({
      users: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    });

    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query.params[0]).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('should not query at all for an empty page', async () => {
    const { users, queries } = await listUsers({ users: [] });

    expect(users).toEqual([]);
    expect(queries).toHaveLength(0);
  });
});
