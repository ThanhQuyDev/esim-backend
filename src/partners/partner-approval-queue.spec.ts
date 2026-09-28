import { BadRequestException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnerStatusEnum } from './partners.enum';
import type { PartnerEntity } from './infrastructure/persistence/relational/entities/partner.entity';

/**
 * The approvals screen (#055, #056).
 *
 * Two things the old flow got wrong. An admin searching for an applicant has
 * their phone number in front of them, not their email — that is what the
 * applicant rang from. And a rejection was a dead end: the applicant sends the
 * missing licence and there was no way back except applying again.
 */

function buildListService() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'createQueryBuilder',
    'leftJoinAndSelect',
    'andWhere',
    'addSelect',
    'orderBy',
    'addOrderBy',
    'offset',
    'limit',
  ]) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getRawAndEntities = jest.fn().mockResolvedValue({ entities: [], raw: [] });
  qb.getMany = jest.fn().mockResolvedValue([]);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    partnerRepository: { createQueryBuilder: () => qb },
    dataSource: { query: jest.fn().mockResolvedValue([]) },
  });
  return { service, qb };
}

describe('PartnersService.adminList — searching an application (#055)', () => {
  it('should search the phone number as well as name and email', async () => {
    const { service, qb } = buildListService();

    await service.adminList({ search: '0901234567' });

    const clause = (qb.andWhere.mock.calls as [string, unknown][]).find(
      ([sql]) => sql.includes('ILIKE'),
    );
    expect(clause?.[0]).toContain('partner.contactPhone ILIKE :search');
    expect(clause?.[0]).toContain('partner.contactEmail ILIKE :search');
    // A phone number is all digits, so the id clause rides along too — it
    // costs nothing and an admin pasting an id gets a hit either way.
    expect(clause?.[1]).toMatchObject({ search: '%0901234567%' });
  });

  it('should match the partner id when the search looks like one (#058)', async () => {
    // Support tickets and reconciliation files quote the id, so pasting "#42"
    // or "42" has to find partner 42 rather than nothing at all.
    const { service, qb } = buildListService();

    await service.adminList({ search: '#42' });

    const clause = (
      qb.andWhere.mock.calls as [string, Record<string, unknown>][]
    ).find(([sql]) => sql.includes('ILIKE'));
    expect(clause?.[0]).toContain('partner.id = :id');
    expect(clause?.[1].id).toBe(42);
  });

  it('should not look for an id when the search is a name (#058)', async () => {
    const { service, qb } = buildListService();

    await service.adminList({ search: 'Nguyễn' });

    const clause = (qb.andWhere.mock.calls as [string][]).find(([sql]) =>
      sql.includes('ILIKE'),
    );
    expect(clause?.[0]).not.toContain('partner.id = :id');
  });

  it('should filter by tier when asked (#058)', async () => {
    const { service, qb } = buildListService();

    await service.adminList({ tierCode: 'GOLD' });

    const sql = (qb.andWhere.mock.calls as [string][])
      .map(([s]) => s)
      .join(' ');
    expect(sql).toContain('partner.tierCode = :tierCode');
  });

  it('should filter by partner type and status when asked', async () => {
    const { service, qb } = buildListService();

    await service.adminList({
      partnerType: 'kol' as never,
      status: PartnerStatusEnum.REJECTED,
    });

    const sql = (qb.andWhere.mock.calls as [string][])
      .map(([s]) => s)
      .join(' ');
    expect(sql).toContain('partner.partnerType = :partnerType');
    expect(sql).toContain('partner.status = :status');
  });
});

function buildDecisionService(status: PartnerStatusEnum) {
  const partner = {
    id: 8,
    userId: 100,
    status,
    rejectionReason:
      status === PartnerStatusEnum.REJECTED ? 'Thiếu giấy phép' : null,
    adminNote: null,
  } as unknown as PartnerEntity;

  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
    adminFindById: jest.fn().mockResolvedValue(partner),
    partnerRepository: { save },
    dataSource: {
      transaction: async (fn: (m: unknown) => Promise<unknown>) =>
        fn({
          getRepository: () => ({
            save: (row: unknown) => Promise.resolve(row),
            update: () => Promise.resolve(undefined),
          }),
        }),
    },
    notifyPartnerDecision: jest.fn(),
  });
  return { service, save, partner };
}

describe('PartnersService.approve — a rejection is not a dead end (#056)', () => {
  it('should approve an application that is waiting', async () => {
    const { service } = buildDecisionService(PartnerStatusEnum.PENDING);

    await expect(service.approve(8, 1)).resolves.toMatchObject({
      status: PartnerStatusEnum.ACTIVE,
    });
  });

  it('should let an admin approve one that was rejected', async () => {
    // The applicant sent the missing licence; making them apply again would be
    // the system's problem, not theirs.
    const { service } = buildDecisionService(PartnerStatusEnum.REJECTED);

    await expect(service.approve(8, 1)).resolves.toMatchObject({
      status: PartnerStatusEnum.ACTIVE,
    });
  });

  it('should clear the rejection reason once approved', async () => {
    // Otherwise the record reads as approved and rejected at once, and that is
    // the line support would read back to the partner.
    const { service } = buildDecisionService(PartnerStatusEnum.REJECTED);

    const saved = await service.approve(8, 1);

    expect(saved.rejectionReason).toBeNull();
  });

  it('should refuse to approve one that is already active', async () => {
    const { service } = buildDecisionService(PartnerStatusEnum.ACTIVE);

    await expect(service.approve(8, 1)).rejects.toThrow(BadRequestException);
  });
});

describe('PartnersService.setAdminNote (#056)', () => {
  it('should save the reviewer’s note', async () => {
    const { service, save } = buildDecisionService(PartnerStatusEnum.PENDING);

    await service.setAdminNote(8, '  Đã gọi xác minh kênh bán  ');

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ adminNote: 'Đã gọi xác minh kênh bán' }),
    );
  });

  it('should clear the note when it is emptied', async () => {
    const { service, save } = buildDecisionService(PartnerStatusEnum.PENDING);

    await service.setAdminNote(8, '   ');

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ adminNote: null }),
    );
  });
});
