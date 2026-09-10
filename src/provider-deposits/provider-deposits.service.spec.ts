import { ProviderDepositsService } from './provider-deposits.service';
import { ProviderDepositEntryType } from './infrastructure/persistence/relational/entities/provider-deposit-entry.entity';

/**
 * The point of this screen is spotting drift: what we think is left on deposit
 * with a supplier vs what the supplier says is left. These tests pin that
 * arithmetic down, including the cases that are easy to get wrong (a
 * reconciliation must not move money; a supplier with spend but no deposit
 * entry must still be listed).
 */

function entry(overrides: Record<string, unknown>) {
  return {
    id: 1,
    provider: 'esimaccess',
    type: ProviderDepositEntryType.Deposit,
    amountVnd: 0,
    reportedBalanceVnd: null,
    note: null,
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeService(entries: unknown[], spendRows: unknown[]) {
  const entriesRepository = {
    find: jest.fn().mockResolvedValue(entries),
  };

  const qb: Record<string, jest.Mock> = {};
  const chain = () => () => qb;
  qb.innerJoin = jest.fn(chain());
  qb.where = jest.fn(chain());
  qb.andWhere = jest.fn(chain());
  qb.select = jest.fn(chain());
  qb.addSelect = jest.fn(chain());
  qb.groupBy = jest.fn(chain());
  qb.getRawMany = jest.fn().mockResolvedValue(spendRows);

  const orderItemsRepository = { createQueryBuilder: () => qb };

  return new ProviderDepositsService(
    entriesRepository as never,
    orderItemsRepository as never,
  );
}

describe('ProviderDepositsService.getSummary', () => {
  it('should report the balance left and how far the supplier disagrees', async () => {
    const service = makeService(
      [
        entry({ id: 1, amountVnd: 100_000_000 }),
        entry({
          id: 2,
          type: ProviderDepositEntryType.Reconciliation,
          amountVnd: 0,
          reportedBalanceVnd: 41_500_000,
          occurredAt: new Date('2026-02-01T00:00:00.000Z'),
        }),
      ],
      [{ provider: 'esimaccess', spent: '58000000' }],
    );

    const [row] = await service.getSummary();

    expect(row.provider).toBe('esimaccess');
    expect(row.totalDepositedVnd).toBe(100_000_000);
    expect(row.totalSpentVnd).toBe(58_000_000);
    expect(row.expectedBalanceVnd).toBe(42_000_000);
    expect(row.reportedBalanceVnd).toBe(41_500_000);
    // Supplier says 500k less than our books — that is the drift to chase.
    expect(row.differenceVnd).toBe(-500_000);
    expect(row.reportedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('should not let a reconciliation entry change the deposited total', async () => {
    const service = makeService(
      [
        entry({ id: 1, amountVnd: 10_000_000 }),
        entry({
          id: 2,
          type: ProviderDepositEntryType.Reconciliation,
          // A stray amount on a reconciliation row must be ignored, otherwise
          // simply recording what the supplier said would inflate the deposit.
          amountVnd: 999_999,
          reportedBalanceVnd: 10_000_000,
        }),
      ],
      [],
    );

    const [row] = await service.getSummary();
    expect(row.totalDepositedVnd).toBe(10_000_000);
  });

  it('should keep the latest reported balance, not the first one', async () => {
    const service = makeService(
      [
        entry({ id: 1, reportedBalanceVnd: 1_000_000 }),
        entry({
          id: 2,
          reportedBalanceVnd: 2_000_000,
          occurredAt: new Date('2026-03-01T00:00:00.000Z'),
        }),
      ],
      [],
    );

    const [row] = await service.getSummary();
    expect(row.reportedBalanceVnd).toBe(2_000_000);
  });

  it('should list a supplier that has spend but no deposit entry yet', async () => {
    const service = makeService([], [{ provider: 'airalo', spent: '250000' }]);

    const [row] = await service.getSummary();
    expect(row.provider).toBe('airalo');
    expect(row.totalDepositedVnd).toBe(0);
    expect(row.expectedBalanceVnd).toBe(-250_000);
    // Never reported ⇒ no drift can be computed yet.
    expect(row.differenceVnd).toBeNull();
  });
});
