import { PartnersService } from './partners.service';
import { PartnerStatusEnum } from './partners.enum';

/**
 * Telling an applicant the outcome (#095).
 *
 * An affiliate application was decided in silence: approved or rejected, the
 * person who applied heard nothing and had to keep logging in to find out.
 * `PartnersService` never referenced `MailService` at all.
 *
 * The mail must never be able to undo the decision, so it is sent after the
 * transaction commits and its failures are swallowed — that is what most of
 * these tests are really checking.
 */
describe('PartnersService — application decision emails', () => {
  function buildService(mailService: Record<string, jest.Mock>) {
    const partner = {
      id: 3,
      userId: 11,
      status: PartnerStatusEnum.PENDING,
      contactName: 'Trần Thị B',
      contactEmail: 'b@example.com',
      rejectionReason: null as string | null,
    };

    const partnerRepository = {
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };

    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      logger: { error: jest.fn(), warn: jest.fn() },
      partnerRepository,
      userRepository: { update: jest.fn() },
      dataSource: {
        transaction: (cb: (m: unknown) => Promise<unknown>) =>
          cb({
            getRepository: () => ({
              save: partnerRepository.save,
              update: jest.fn(),
            }),
          }),
      },
      mailService,
      adminFindById: jest.fn().mockResolvedValue(partner),
    });

    return { service, partner };
  }

  it('should email the applicant when the application is approved', async () => {
    const mailService = {
      sendPartnerApproved: jest.fn().mockResolvedValue(undefined),
      sendPartnerRejected: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = buildService(mailService);

    await service.approve(3, 99);

    expect(mailService.sendPartnerApproved).toHaveBeenCalledWith({
      to: 'b@example.com',
      contactName: 'Trần Thị B',
    });
    expect(mailService.sendPartnerRejected).not.toHaveBeenCalled();
  });

  it('should email the applicant the reason when it is rejected', async () => {
    const mailService = {
      sendPartnerApproved: jest.fn().mockResolvedValue(undefined),
      sendPartnerRejected: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = buildService(mailService);

    await service.reject(3, { reason: 'Thiếu giấy phép kinh doanh' }, 99);

    expect(mailService.sendPartnerRejected).toHaveBeenCalledWith({
      to: 'b@example.com',
      contactName: 'Trần Thị B',
      // Without the reason the applicant cannot fix anything and just reapplies
      // the same way.
      reason: 'Thiếu giấy phép kinh doanh',
    });
    expect(mailService.sendPartnerApproved).not.toHaveBeenCalled();
  });

  it('should still approve when the mail server is down', async () => {
    const mailService = {
      sendPartnerApproved: jest
        .fn()
        .mockRejectedValue(new Error('SMTP timeout')),
      sendPartnerRejected: jest.fn().mockResolvedValue(undefined),
    };
    const { service } = buildService(mailService);

    const saved = await service.approve(3, 99);
    // Let the rejected promise settle so an unhandled rejection would surface.
    await new Promise((resolve) => setImmediate(resolve));

    expect(saved.status).toBe(PartnerStatusEnum.ACTIVE);
  });

  it('should not try to send anything without a contact address', async () => {
    const mailService = {
      sendPartnerApproved: jest.fn().mockResolvedValue(undefined),
      sendPartnerRejected: jest.fn().mockResolvedValue(undefined),
    };
    const { service, partner } = buildService(mailService);
    partner.contactEmail = '';

    await service.approve(3, 99);

    expect(mailService.sendPartnerApproved).not.toHaveBeenCalled();
  });
});
