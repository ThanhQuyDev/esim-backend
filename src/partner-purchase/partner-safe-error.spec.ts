import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PartnerPurchaseService } from './partner-purchase.service';
import {
  TOPUP_LIST_UNAVAILABLE,
  TOPUP_UNAVAILABLE,
  isPartnerSafeMessage,
  toPartnerSafeError,
} from './partner-safe-error';

/**
 * doitac-0911 #006: "Topup hộ khách" showed the supplier's own error to the
 * distribution partner — who the supplier is, its code and its message.
 */
describe('toPartnerSafeError (doitac-0911 #006)', () => {
  it.each([
    'Airalo API error: 422 The package is not available',
    'eSIM Access returned errorCode 200007: insufficient balance',
    'BILLION F015 error: no package',
    'MicroEsim API error: token expired',
    'Request failed with status code 429',
    'connect ECONNREFUSED 10.0.0.1:443',
    'Provider package PK-123 not found',
  ])('should hide "%s"', (text) => {
    expect(isPartnerSafeMessage(text)).toBe(false);
    const err = toPartnerSafeError(new BadRequestException(text), 'chung');
    expect(err.message).toBe('chung');
  });

  it.each([
    'Số dư ví không đủ để topup. Cần nạp thêm 50.000đ.',
    'Ví ký quỹ đang bị khoá. Liên hệ esim.vn để mở lại.',
    'Gói topup này chưa có giá vốn, chưa thể bán cho đối tác.',
  ])('should keep our own refusal "%s"', (text) => {
    const original = new BadRequestException(text);
    expect(toPartnerSafeError(original, 'chung')).toBe(original);
  });

  it('should hide a server error and anything that is not ours', () => {
    expect(
      toPartnerSafeError(
        new InternalServerErrorException('Số dư ví không đủ'),
        'chung',
      ).message,
    ).toBe('chung');
    expect(toPartnerSafeError(new Error('boom'), 'chung').message).toBe(
      'chung',
    );
  });
});

describe('Partner topup never shows the supplier (doitac-0911 #006)', () => {
  const build = (topupService: Record<string, jest.Mock>) => {
    const service = Object.create(
      PartnerPurchaseService.prototype,
    ) as PartnerPurchaseService;
    Object.assign(service as unknown as Record<string, unknown>, {
      logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
      partnersService: {
        assertOwnsEsim: jest.fn().mockResolvedValue(undefined),
        getPartnerOrThrowById: jest
          .fn()
          .mockResolvedValue({ id: 11, userId: 20 }),
      },
      topupService,
    });
    return service;
  };

  it('should give the general message when the package list fails', async () => {
    const service = build({
      listPackagesWithCost: jest
        .fn()
        .mockRejectedValue(
          new BadRequestException(
            'Airalo API error: Request failed with status code 422',
          ),
        ),
    });

    const failure = service.listTopupPackages(11, '8900000833431757341');
    await expect(failure).rejects.toThrow(TOPUP_LIST_UNAVAILABLE);
    await expect(failure).rejects.not.toThrow(/Airalo/);
  });

  it('should give the general message when the topup itself fails', async () => {
    const service = build({
      checkoutForPartner: jest
        .fn()
        .mockRejectedValue(new Error('eSIM Access errorCode 310241')),
    });

    await expect(
      service.topupEsim(11, '8900000833431757341', 'PKG'),
    ).rejects.toThrow(TOPUP_UNAVAILABLE);
  });

  it('should still say why when it is our own refusal', async () => {
    const service = build({
      checkoutForPartner: jest
        .fn()
        .mockRejectedValue(
          new BadRequestException('Số dư ví không đủ để topup.'),
        ),
    });

    await expect(
      service.topupEsim(11, '8900000833431757341', 'PKG'),
    ).rejects.toThrow('Số dư ví không đủ để topup.');
  });
});
