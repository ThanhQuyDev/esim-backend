import { PartnersService } from './partners.service';
import { OrderPartnerCommissionStatusEnum } from './partners.enum';
import type { PartnerEntity } from './infrastructure/persistence/relational/entities/partner.entity';

/**
 * A partner changing tier in the middle of a reconciliation period (#042).
 *
 * "Đơn phát sinh SAU thời điểm lên hạng chính thức tính theo hạng mới, đơn trước
 * đó giữ nguyên hạng cũ — không hồi tố."
 *
 * The rate is worked out and stored when the order is placed, so nothing has to
 * reach back later — which is exactly the property worth pinning down, because a
 * later "recalculate commissions" would quietly break it. What was missing was
 * the evidence: when the tier changed, and what rate each order was paid at.
 */

function buildService(tier: { tierCode: string; commissionPercent: number }) {
  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const tierSave = jest.fn().mockResolvedValue(undefined);
  const partnerSave = jest
    .fn()
    .mockImplementation((row) => Promise.resolve(row));
  const service = Object.create(PartnersService.prototype) as PartnersService;

  Object.assign(service, {
    logger: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
    partnerRepository: {
      findOne: jest.fn().mockResolvedValue({
        id: 8,
        userId: 100,
        partnerType: 'kol',
        tierCode: tier.tierCode,
      } as unknown as PartnerEntity),
      save: partnerSave,
    },
    tierRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue({ commissionPercent: tier.commissionPercent }),
    },
    tierEvaluationRepository: {
      create: (row: unknown) => row,
      save: tierSave,
    },
    commissionRepository: { save, create: (row: unknown) => row },
    detectSelfReferral: jest.fn().mockResolvedValue(null),
  });

  return { service, save, tierSave, partnerSave };
}

describe('Commission rates across a tier change (#042)', () => {
  it('should pay an order at the rate in force when it was placed', async () => {
    const { service } = buildService({
      tierCode: 'SILVER',
      commissionPercent: 5,
    });

    await expect(
      service.createPendingCommissionForOrder({
        orderId: 1,
        partnerId: 8,
        linkId: 11,
        orderValueVnd: 1_000_000,
        buyerUserId: 200,
      }),
    ).resolves.toMatchObject({
      commissionVnd: 50_000,
      tierSnapshot: 'SILVER',
      commissionPercentSnapshot: 5,
      status: OrderPartnerCommissionStatusEnum.PENDING,
    });
  });

  it('should pay a later order at the new rate, leaving the earlier one alone', async () => {
    // Order placed on SILVER: 5% of a million.
    const before = buildService({ tierCode: 'SILVER', commissionPercent: 5 });
    const earlier = await before.service.createPendingCommissionForOrder({
      orderId: 1,
      partnerId: 8,
      linkId: 11,
      orderValueVnd: 1_000_000,
      buyerUserId: 200,
    });

    // Promoted to GOLD; the next order earns 8%.
    const after = buildService({ tierCode: 'GOLD', commissionPercent: 8 });
    const later = await after.service.createPendingCommissionForOrder({
      orderId: 2,
      partnerId: 8,
      linkId: 11,
      orderValueVnd: 1_000_000,
      buyerUserId: 201,
    });

    expect(earlier).toMatchObject({
      commissionVnd: 50_000,
      tierSnapshot: 'SILVER',
    });
    expect(later).toMatchObject({
      commissionVnd: 80_000,
      tierSnapshot: 'GOLD',
    });
    // The point of the rule: the earlier order is untouched by the promotion.
    expect(earlier!.commissionVnd).toBe(50_000);
  });

  it('should store the rate so a later edit to the tier cannot rewrite history', async () => {
    const { service } = buildService({
      tierCode: 'SILVER',
      commissionPercent: 5,
    });

    const commission = await service.createPendingCommissionForOrder({
      orderId: 1,
      partnerId: 8,
      linkId: 11,
      orderValueVnd: 1_000_000,
      buyerUserId: 200,
    });

    // An admin raising SILVER to 9% afterwards changes the tier, not this row.
    expect(commission!.commissionPercentSnapshot).toBe(5);
  });
});

describe('PartnersService.assignTier — the change is dated and logged (#042)', () => {
  it('should stamp the moment the tier took effect', async () => {
    const { service, partnerSave } = buildService({
      tierCode: 'SILVER',
      commissionPercent: 5,
    });
    Object.assign(service, {
      adminFindById: jest.fn().mockResolvedValue({
        id: 8,
        partnerType: 'kol',
        tierCode: 'SILVER',
      } as unknown as PartnerEntity),
      tierRepository: {
        findOne: jest.fn().mockResolvedValue({ tierCode: 'GOLD' }),
      },
    });
    const before = Date.now();

    await service.assignTier(8, { tierCode: 'GOLD' });

    const saved = partnerSave.mock.calls[0][0] as {
      tierCode: string;
      tierEffectiveFrom: Date;
    };
    expect(saved.tierCode).toBe('GOLD');
    expect(saved.tierEffectiveFrom.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('should leave a trail for a change made by hand', async () => {
    const { service, tierSave } = buildService({
      tierCode: 'SILVER',
      commissionPercent: 5,
    });
    Object.assign(service, {
      adminFindById: jest.fn().mockResolvedValue({
        id: 8,
        partnerType: 'kol',
        tierCode: 'SILVER',
      } as unknown as PartnerEntity),
      tierRepository: {
        findOne: jest.fn().mockResolvedValue({ tierCode: 'GOLD' }),
      },
    });

    await service.assignTier(8, { tierCode: 'GOLD' });

    expect(tierSave).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 8,
        tierBefore: 'SILVER',
        tierAfter: 'GOLD',
        result: 'manual',
      }),
    );
  });

  it('should not re-date a tier that did not change', async () => {
    // Re-selecting the same tier is not a promotion, and moving the date would
    // move the line orders are judged against.
    const { service, tierSave, partnerSave } = buildService({
      tierCode: 'SILVER',
      commissionPercent: 5,
    });
    Object.assign(service, {
      adminFindById: jest.fn().mockResolvedValue({
        id: 8,
        partnerType: 'kol',
        tierCode: 'SILVER',
        tierEffectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      } as unknown as PartnerEntity),
      tierRepository: {
        findOne: jest.fn().mockResolvedValue({ tierCode: 'SILVER' }),
      },
    });

    await service.assignTier(8, { tierCode: 'SILVER' });

    const saved = partnerSave.mock.calls[0][0] as { tierEffectiveFrom: Date };
    expect(saved.tierEffectiveFrom.toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(tierSave).not.toHaveBeenCalled();
  });
});
