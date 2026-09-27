import bcrypt from 'bcryptjs';
import { PartnersService } from './partners.service';

/**
 * Changing where the payouts go needs the emailed code (#005).
 *
 * Until now a bank account was an ordinary profile field: anyone holding a
 * partner session could point the next payout at their own account, silently.
 */

const NEW_ACCOUNT = {
  bankName: 'Vietcombank',
  bankAccountNumber: '0123456789',
  bankAccountHolder: 'TRAN THU HA',
};

function buildService(partner: Record<string, unknown>) {
  const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
  const sendPartnerBankChangeOtp = jest.fn().mockResolvedValue(undefined);

  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    partnerRepository: {
      findOne: jest.fn().mockResolvedValue(partner),
      save,
    },
    mailService: { sendPartnerBankChangeOtp },
  });

  return { service, save, sendPartnerBankChangeOtp, partner };
}

function freshPartner() {
  return {
    id: 5,
    userId: 7,
    contactName: 'Trần Thu Hà',
    contactEmail: 'thu.ha@esim.vn',
    bankName: 'ACB',
    bankAccountNumber: '999',
    bankAccountHolder: 'CU',
    bankBranch: null,
    pendingBankChange: null as unknown,
  };
}

describe('PartnersService — bank account change needs an emailed code (#005)', () => {
  it('should not touch the live account when the change is requested', async () => {
    const { service, sendPartnerBankChangeOtp, partner } =
      buildService(freshPartner());

    const result = await service.requestBankAccountChange(7, NEW_ACCOUNT);

    expect(partner.bankAccountNumber).toBe('999');
    expect(partner.pendingBankChange).toEqual(
      expect.objectContaining({ values: expect.objectContaining(NEW_ACCOUNT) }),
    );
    // The portal says where the code went without printing the whole address.
    expect(result.sentTo).toBe('th****@esim.vn');

    const mail = sendPartnerBankChangeOtp.mock.calls[0][0];
    expect(mail.to).toBe('thu.ha@esim.vn');
    expect(mail.bankSummary).toContain('0123456789');
    // The code itself is only in the email; the row keeps a hash of it.
    const pending = partner.pendingBankChange as { otpHash: string };
    await expect(bcrypt.compare(mail.otp, pending.otpHash)).resolves.toBe(true);
  });

  it('should apply the requested account once the right code arrives', async () => {
    const { service, sendPartnerBankChangeOtp, partner } =
      buildService(freshPartner());
    await service.requestBankAccountChange(7, {
      ...NEW_ACCOUNT,
      bankBranch: 'Tân Bình',
    });
    const { otp } = sendPartnerBankChangeOtp.mock.calls[0][0];

    await service.confirmBankAccountChange(7, otp);

    expect(partner.bankName).toBe('Vietcombank');
    expect(partner.bankAccountNumber).toBe('0123456789');
    expect(partner.bankBranch).toBe('Tân Bình');
    expect(partner.pendingBankChange).toBeNull();
  });

  it('should count a wrong code and leave the account alone', async () => {
    const { service, sendPartnerBankChangeOtp, partner } =
      buildService(freshPartner());
    await service.requestBankAccountChange(7, NEW_ACCOUNT);
    const { otp } = sendPartnerBankChangeOtp.mock.calls[0][0];
    const wrong = otp === '000000' ? '111111' : '000000';

    await expect(
      service.confirmBankAccountChange(7, wrong),
    ).rejects.toMatchObject({ response: { errors: { otp: 'otpInvalid' } } });

    expect(partner.bankAccountNumber).toBe('999');
    expect(partner.pendingBankChange).toEqual(
      expect.objectContaining({ attempts: 1 }),
    );
  });

  it('should refuse an expired code and drop the pending change', async () => {
    const partner = freshPartner();
    const { service } = buildService(partner);
    await service.requestBankAccountChange(7, NEW_ACCOUNT);
    const pending = partner.pendingBankChange as { expiresAt: string };
    pending.expiresAt = new Date(Date.now() - 1000).toISOString();

    await expect(
      service.confirmBankAccountChange(7, '123456'),
    ).rejects.toMatchObject({ response: { errors: { otp: 'otpExpired' } } });

    expect(partner.pendingBankChange).toBeNull();
    expect(partner.bankAccountNumber).toBe('999');
  });

  it('should not re-send a code within the minute', async () => {
    const { service } = buildService(freshPartner());
    await service.requestBankAccountChange(7, NEW_ACCOUNT);

    await expect(
      service.requestBankAccountChange(7, NEW_ACCOUNT),
    ).rejects.toMatchObject({
      response: { errors: { otp: 'otpRecentlySent' } },
    });
  });

  it('should refuse to confirm when nothing was requested', async () => {
    const { service } = buildService(freshPartner());

    await expect(
      service.confirmBankAccountChange(7, '123456'),
    ).rejects.toMatchObject({ response: { errors: { otp: 'otpNotFound' } } });
  });
});
