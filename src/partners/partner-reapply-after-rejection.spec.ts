import bcrypt from 'bcryptjs';
import { PartnersService } from './partners.service';
import {
  PartnerLegalTypeEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
} from './partners.enum';
import type { PartnerApplyDto } from './dto/partner-apply.dto';

/**
 * Applying again after a rejection (#003).
 *
 * The rejection email tells the applicant to fill the form in again, but the
 * form answered their own address with "emailAlreadyExists" — the user row from
 * the first attempt was still there — so the instruction was impossible to
 * follow. A rejected profile now accepts a second application.
 */

const DTO: PartnerApplyDto = {
  partnerType: PartnerTypeEnum.KOL,
  legalType: PartnerLegalTypeEnum.INDIVIDUAL,
  contactName: 'Nguyen Van A',
  contactPhone: '0901234567',
  contactEmail: 'kol@esim.vn',
  password: 'second-try',
  notes: 'Đã bổ sung kênh TikTok',
};

function buildService(partnerOnFile: Record<string, unknown> | null) {
  const userUpdate = jest.fn().mockResolvedValue(undefined);
  const partnerSave = jest
    .fn()
    .mockImplementation((row) => Promise.resolve(row));
  const partnerMerge = jest
    .fn()
    .mockImplementation((entity, patch) => Object.assign(entity, patch));

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    userRepository: {
      findOne: jest.fn().mockResolvedValue({ id: 7, email: DTO.contactEmail }),
    },
    partnerRepository: {
      findOne: jest.fn().mockResolvedValue(partnerOnFile),
    },
    dataSource: {
      transaction: (run: (manager: unknown) => unknown) =>
        run({
          getRepository: (entity: { name: string }) =>
            entity.name === 'UserEntity'
              ? { update: userUpdate }
              : { save: partnerSave, merge: partnerMerge },
        }),
    },
  });

  return { service, userUpdate, partnerSave };
}

describe('PartnersService — applying again after a rejection (#003)', () => {
  it('should put the rejected profile back in the queue with the new answers', async () => {
    const onFile = {
      id: 3,
      status: PartnerStatusEnum.REJECTED,
      rejectionReason: 'Kênh chưa đủ người theo dõi',
      contactName: 'Cũ',
    };
    const { service, partnerSave } = buildService(onFile);

    await expect(service.apply(DTO)).resolves.toEqual({
      partnerId: 3,
      userId: 7,
    });

    expect(partnerSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 3,
        status: PartnerStatusEnum.PENDING,
        contactName: 'Nguyen Van A',
        notes: 'Đã bổ sung kênh TikTok',
        // A fresh review should not read last time's verdict.
        rejectionReason: null,
      }),
    );
  });

  it('should let them sign in with the password of the second attempt', async () => {
    const { service, userUpdate } = buildService({
      id: 3,
      status: PartnerStatusEnum.REJECTED,
    });

    await service.apply(DTO);

    const [id, patch] = userUpdate.mock.calls[0] as [
      number,
      { password: string; phoneNumber: string },
    ];
    expect(id).toBe(7);
    expect(patch.phoneNumber).toBe(DTO.contactPhone);
    await expect(bcrypt.compare(DTO.password, patch.password)).resolves.toBe(
      true,
    );
  });

  it('should still refuse an email that belongs to a live partner', async () => {
    // No REJECTED profile for this user, so the address really is taken.
    const { service } = buildService(null);

    await expect(service.apply(DTO)).rejects.toMatchObject({
      response: { errors: { contactEmail: 'emailAlreadyExists' } },
    });
  });
});
