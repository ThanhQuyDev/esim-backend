import { PartnersService, partnerStatusNotice } from './partners.service';
import { partnerPurchaseRejection } from './partner-purchase';
import { PartnerStatusEnum, PartnerTypeEnum } from './partners.enum';

/** doitac-0911 #023 — locking and unlocking are told to the partner. */
describe('partnerStatusNotice (doitac-0911 #023)', () => {
  it('should tell a hold, a lock and an unlock, with the reason', () => {
    expect(partnerStatusNotice('active', 'hold', 'Đối soát công nợ')).toEqual({
      title: 'Tài khoản đối tác của bạn đang bị tạm khoá',
      body: expect.stringContaining('Lý do: Đối soát công nợ.'),
    });
    expect(partnerStatusNotice('hold', 'disabled', 'x')?.title).toBe(
      'Tài khoản đối tác của bạn đã bị khoá',
    );
    expect(partnerStatusNotice('hold', 'active')?.title).toBe(
      'Tài khoản đối tác của bạn đã được mở khoá',
    );
  });

  it('should stay quiet on an approval or a rejection', () => {
    expect(partnerStatusNotice('pending', 'active')).toBeNull();
    expect(partnerStatusNotice('pending', 'rejected')).toBeNull();
  });
});

describe('updateStatus sends the notice (doitac-0911 #023)', () => {
  it('should notify the partner when an admin holds the account', async () => {
    const partner = { id: 11, status: PartnerStatusEnum.ACTIVE };
    const notifyOnePartner = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service as unknown as Record<string, unknown>, {
      adminFindById: jest.fn().mockResolvedValue(partner),
      partnerRepository: { save: jest.fn((p) => Promise.resolve(p)) },
      applyStatusConsequences: jest.fn().mockResolvedValue(undefined),
      recordStatusChange: jest.fn().mockResolvedValue(undefined),
      notifyOnePartner,
      logger: { error: jest.fn() },
    });

    await service.updateStatus(
      11,
      { status: PartnerStatusEnum.HOLD } as never,
      1,
      'Đối soát công nợ',
    );

    expect(notifyOnePartner).toHaveBeenCalledWith(
      11,
      'Tài khoản đối tác của bạn đang bị tạm khoá',
      expect.stringContaining('Đối soát công nợ'),
      1,
    );
  });
});

describe('Buying while held says so (doitac-0911 #023)', () => {
  it('should not say "chưa được kích hoạt" to a held partner', () => {
    const message = partnerPurchaseRejection(
      {
        partnerType: PartnerTypeEnum.DISTRIBUTION,
        partnerStatus: PartnerStatusEnum.HOLD,
        walletLocked: true,
        balanceVnd: 1_000_000,
      },
      { quantity: 1, unitPriceVnd: 100, totalVnd: 100 } as never,
    );
    expect(message).toContain('đang bị tạm khoá');
    expect(message).not.toContain('chưa được kích hoạt');
  });
});
