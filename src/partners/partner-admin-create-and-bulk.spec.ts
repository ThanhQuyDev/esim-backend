import { BadRequestException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnerStatusEnum } from './partners.enum';

/**
 * Adding a partner by hand, and changing several at once (#059).
 *
 * Some partners are signed over the phone and cannot be asked to fill in a form
 * and wait for a review. The admin gives the details; the password is the one
 * thing they must not choose for somebody else, so the system mints it, emails
 * it, and marks the account so it is replaced at the first sign-in.
 */

function buildService(
  opts: {
    existingUser?: boolean;
    partners?: { id: number; status: PartnerStatusEnum }[];
  } = {},
) {
  const savedUsers: Record<string, unknown>[] = [];
  const savedPartners: Record<string, unknown>[] = [];
  const statusChanges: Record<string, unknown>[] = [];
  const sendPartnerAccountCreated = jest.fn().mockResolvedValue(undefined);
  const partnerSave = jest
    .fn()
    .mockImplementation((row) => Promise.resolve(row));

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
    userRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue(opts.existingUser ? { id: 1 } : null),
    },
    partnerRepository: {
      find: jest.fn().mockResolvedValue(opts.partners ?? []),
      save: partnerSave,
    },
    statusChangeRepository: {
      create: (row: unknown) => row,
      save: jest.fn().mockImplementation((row) => {
        statusChanges.push(row as Record<string, unknown>);
        return Promise.resolve(row);
      }),
    },
    mailService: { sendPartnerAccountCreated },
    dataSource: {
      transaction: async (fn: (m: unknown) => Promise<unknown>) =>
        fn({
          getRepository: (entity: { name: string }) => ({
            create: (row: unknown) => row,
            save: (row: Record<string, unknown>) => {
              const withId = { id: 7, ...row };
              if (entity.name === 'UserEntity') savedUsers.push(withId);
              if (entity.name === 'PartnerEntity') savedPartners.push(withId);
              return Promise.resolve(withId);
            },
          }),
        }),
    },
  });

  return {
    service,
    savedUsers,
    savedPartners,
    statusChanges,
    sendPartnerAccountCreated,
    partnerSave,
  };
}

const DTO = {
  partnerType: 'kol',
  legalType: 'individual',
  contactName: 'Nguyễn Văn A',
  contactPhone: '0901234567',
  contactEmail: 'vip@example.com',
} as never;

describe('PartnersService.adminCreatePartner (#059)', () => {
  it('should create the account active, with no approval left to do', async () => {
    const { service, savedPartners } = buildService();

    await service.adminCreatePartner(DTO, 1);

    expect(savedPartners[0]).toMatchObject({
      status: PartnerStatusEnum.ACTIVE,
      contactEmail: 'vip@example.com',
      approvedByAdminId: 1,
    });
  });

  it('should mint a password rather than take one from the admin', async () => {
    const { service, savedUsers, sendPartnerAccountCreated } = buildService();

    await service.adminCreatePartner(DTO, 1);

    // Stored hashed, never as typed.
    expect(String(savedUsers[0].password)).toMatch(/^\$2[aby]\$/);
    const emailed = sendPartnerAccountCreated.mock.calls[0][0] as {
      temporaryPassword: string;
    };
    expect(emailed.temporaryPassword.length).toBeGreaterThan(6);
  });

  it('should make the partner replace that password at first sign-in', async () => {
    // It travelled through an inbox, so it must not stay the account's.
    const { service, savedUsers } = buildService();

    await service.adminCreatePartner(DTO, 1);

    expect(savedUsers[0].mustChangePassword).toBe(true);
  });

  it('should email the partner their login', async () => {
    const { service, sendPartnerAccountCreated } = buildService();

    await service.adminCreatePartner(DTO, 1);

    expect(sendPartnerAccountCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'vip@example.com',
        email: 'vip@example.com',
      }),
    );
  });

  it('should refuse an email that already has an account', async () => {
    const { service } = buildService({ existingUser: true });

    await expect(service.adminCreatePartner(DTO, 1)).rejects.toThrow();
  });

  it('should record how the partner came to be active', async () => {
    const { service, statusChanges } = buildService();

    await service.adminCreatePartner(DTO, 1);

    expect(statusChanges[0]).toMatchObject({
      fromStatus: null,
      toStatus: PartnerStatusEnum.ACTIVE,
      changedByAdminId: 1,
    });
  });
});

describe('PartnersService.bulkUpdateStatus (#059, #060)', () => {
  it('should change every partner that is not already there', async () => {
    const { service, partnerSave } = buildService({
      partners: [
        { id: 1, status: PartnerStatusEnum.ACTIVE },
        { id: 2, status: PartnerStatusEnum.ACTIVE },
      ],
    });

    const result = await service.bulkUpdateStatus(
      {
        ids: [1, 2],
        status: PartnerStatusEnum.HOLD,
        reason: 'Nghi ngờ gian lận',
      },
      1,
    );

    expect(result.updated).toBe(2);
    expect(partnerSave).toHaveBeenCalledTimes(2);
  });

  it('should demand a reason before locking anyone', async () => {
    // "bắt buộc nhập lý do để lần sau còn biết vấn đề/sự việc" (#060).
    const { service } = buildService({
      partners: [{ id: 1, status: PartnerStatusEnum.ACTIVE }],
    });

    await expect(
      service.bulkUpdateStatus(
        { ids: [1], status: PartnerStatusEnum.DISABLED },
        1,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should not demand one for unlocking', async () => {
    const { service } = buildService({
      partners: [{ id: 1, status: PartnerStatusEnum.HOLD }],
    });

    await expect(
      service.bulkUpdateStatus(
        { ids: [1], status: PartnerStatusEnum.ACTIVE },
        1,
      ),
    ).resolves.toMatchObject({ updated: 1 });
  });

  it('should write the reason into the history', async () => {
    const { service, statusChanges } = buildService({
      partners: [{ id: 1, status: PartnerStatusEnum.ACTIVE }],
    });

    await service.bulkUpdateStatus(
      {
        ids: [1],
        status: PartnerStatusEnum.HOLD,
        reason: '  Nghi ngờ gian lận  ',
      },
      9,
    );

    expect(statusChanges[0]).toMatchObject({
      partnerId: 1,
      fromStatus: PartnerStatusEnum.ACTIVE,
      toStatus: PartnerStatusEnum.HOLD,
      reason: 'Nghi ngờ gian lận',
      changedByAdminId: 9,
    });
  });

  it('should skip a partner already in that state', async () => {
    const { service, partnerSave } = buildService({
      partners: [{ id: 1, status: PartnerStatusEnum.HOLD }],
    });

    const result = await service.bulkUpdateStatus(
      { ids: [1], status: PartnerStatusEnum.HOLD, reason: 'Nghi ngờ' },
      1,
    );

    expect(result.updated).toBe(0);
    expect(partnerSave).not.toHaveBeenCalled();
  });

  it('should report ids that are not there', async () => {
    const { service } = buildService({
      partners: [{ id: 1, status: PartnerStatusEnum.ACTIVE }],
    });

    const result = await service.bulkUpdateStatus(
      { ids: [1, 999], status: PartnerStatusEnum.ACTIVE },
      1,
    );

    expect(result.skipped).toEqual([999]);
  });
});
