import { PartnersService } from './partners.service';

/** Bonus balance on a top-up, under the admin's promotions (doitac-1410 #015). */
function build(promotions: Record<string, unknown>[]) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  const qb = {
    where: () => qb,
    andWhere: () => qb,
    orderBy: () => qb,
    getMany: jest.fn().mockResolvedValue(promotions),
  };
  const createWalletTransaction = jest.fn().mockResolvedValue({ id: 1 });
  Object.assign(service, {
    logger: { error: jest.fn() },
    dataSource: { getRepository: () => ({ createQueryBuilder: () => qb }) },
    createWalletTransaction,
  });
  return { service, createWalletTransaction };
}

const FIVE = {
  id: 1,
  name: 'Tặng 5%',
  bonusPercent: '5.00',
  minDepositVnd: '5000000',
  maxBonusVnd: null,
};

describe('PartnersService deposit promotions (doitac-1410 #015)', () => {
  it('should give the percentage of what was sent', async () => {
    const { service } = build([FIVE]);
    await expect(
      service.depositBonusFor(10_000_000, new Date()),
    ).resolves.toMatchObject({ bonusVnd: 500_000 });
  });

  it("should stop at the promotion's ceiling", async () => {
    const { service } = build([{ ...FIVE, maxBonusVnd: '300000' }]);
    await expect(
      service.depositBonusFor(10_000_000, new Date()),
    ).resolves.toMatchObject({ bonusVnd: 300_000 });
  });

  it('should pick the best of two running promotions', async () => {
    const { service } = build([
      FIVE,
      { ...FIVE, id: 2, name: 'Tặng 8%', bonusPercent: '8.00' },
    ]);
    const best = await service.depositBonusFor(10_000_000, new Date());
    expect(best?.promotion.id).toBe(2);
    expect(best?.bonusVnd).toBe(800_000);
  });

  it('should give nothing when no promotion applies', async () => {
    const { service } = build([]);
    await expect(
      service.depositBonusFor(1_000_000, new Date()),
    ).resolves.toBeNull();
  });

  it('should credit the bonus once per top-up, as its own line', async () => {
    const { service, createWalletTransaction } = build([FIVE]);
    await (
      service as unknown as {
        applyDepositBonus: (r: unknown, at: Date) => Promise<void>;
      }
    ).applyDepositBonus(
      { id: 77, partnerId: 4, amountVnd: 6_000_000 },
      new Date(),
    );

    expect(createWalletTransaction).toHaveBeenCalledWith(
      4,
      'deposit_bonus',
      300_000,
      expect.objectContaining({
        idempotencyKey: 'partner_deposit_bonus:77',
        reason: expect.stringContaining('Tặng 5%'),
      }),
    );
  });
});
