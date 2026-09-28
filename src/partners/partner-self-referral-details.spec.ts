import { PartnersService } from './partners.service';
import {
  CommissionRejectionReasonEnum,
  OrderPartnerCommissionStatusEnum,
  PartnerTypeEnum,
} from './partners.enum';
import type { PartnerEntity } from './infrastructure/persistence/relational/entities/partner.entity';

/**
 * Self-referral past the account itself (#041).
 *
 * "Đơn có thông tin khách trùng thông tin đăng ký của chính đối tác (email, số
 * điện thoại, tài khoản ngân hàng nhận hoa hồng, mã số thuế) → luôn bị loại hoa
 * hồng." Checking the account alone caught nothing: opening a second account is
 * a minute's work. Each detail the partner registered with is another way the
 * same person comes back under another name.
 *
 * The refusal is recorded rather than dropped, because the brief asks for a note
 * an admin can read back when the partner complains.
 */

const REGISTERED = {
  id: 8,
  userId: 100,
  partnerType: PartnerTypeEnum.KOL,
  contactEmail: 'Van.A@example.com',
  contactPhone: '+84 901 234 567',
  taxCode: '0312-345-678',
  bankAccountNumber: '1903 6789 4321',
  tierCode: 'SILVER',
} as unknown as PartnerEntity;

function buildDetector(opts: {
  buyer?: {
    id: number;
    email?: string | null;
    phoneNumber?: string | null;
  } | null;
  buyerPartner?: Partial<PartnerEntity> | null;
  invoiceTaxCode?: string | null;
}) {
  const service = Object.create(PartnersService.prototype) as PartnersService;
  Object.assign(service, {
    logger: { warn: jest.fn(), error: jest.fn() },
    userRepository: {
      findOne: jest.fn().mockResolvedValue(opts.buyer ?? null),
    },
    partnerRepository: {
      findOne: jest.fn().mockResolvedValue(opts.buyerPartner ?? null),
    },
    dataSource: {
      query: jest
        .fn()
        .mockResolvedValue(
          opts.invoiceTaxCode ? [{ taxCode: opts.invoiceTaxCode }] : [],
        ),
    },
  });
  return service;
}

describe('PartnersService.detectSelfReferral (#041)', () => {
  it('should refuse an order placed from the partner own account', async () => {
    const service = buildDetector({});

    await expect(
      service.detectSelfReferral(REGISTERED, { orderId: 1, buyerUserId: 100 }),
    ).resolves.toBe(CommissionRejectionReasonEnum.SELF_ACCOUNT);
  });

  it('should refuse a second account opened on the same email', async () => {
    // The case differs between a sign-up form and a registration form; the
    // person does not.
    const service = buildDetector({
      buyer: { id: 200, email: 'van.a@EXAMPLE.com' },
    });

    await expect(
      service.detectSelfReferral(REGISTERED, { orderId: 1, buyerUserId: 200 }),
    ).resolves.toBe(CommissionRejectionReasonEnum.SELF_EMAIL);
  });

  it('should see through the way a phone number was typed', async () => {
    // Registered as +84 901 234 567, ordered as 0901234567.
    const service = buildDetector({
      buyer: { id: 200, email: 'other@example.com', phoneNumber: '0901234567' },
    });

    await expect(
      service.detectSelfReferral(REGISTERED, { orderId: 1, buyerUserId: 200 }),
    ).resolves.toBe(CommissionRejectionReasonEnum.SELF_PHONE);
  });

  it('should refuse a company buying on the partner own tax code', async () => {
    const service = buildDetector({
      buyer: { id: 200, email: 'ke-toan@example.com' },
      invoiceTaxCode: '0312345678',
    });

    await expect(
      service.detectSelfReferral(REGISTERED, { orderId: 1, buyerUserId: 200 }),
    ).resolves.toBe(CommissionRejectionReasonEnum.SELF_TAX_CODE);
  });

  it('should refuse a second partner account paid into the same bank account', async () => {
    const service = buildDetector({
      buyer: { id: 200, email: 'other@example.com' },
      buyerPartner: {
        id: 9,
        contactEmail: 'other@example.com',
        contactPhone: '0987654321',
        bankAccountNumber: '19036789 4321',
      } as Partial<PartnerEntity>,
    });

    await expect(
      service.detectSelfReferral(REGISTERED, { orderId: 1, buyerUserId: 200 }),
    ).resolves.toBe(CommissionRejectionReasonEnum.SELF_BANK_ACCOUNT);
  });

  it('should pay an ordinary customer', async () => {
    const service = buildDetector({
      buyer: { id: 200, email: 'khach@example.com', phoneNumber: '0912000111' },
      invoiceTaxCode: '0100109106',
    });

    await expect(
      service.detectSelfReferral(REGISTERED, { orderId: 1, buyerUserId: 200 }),
    ).resolves.toBeNull();
  });

  it('should not read a blank or short code as a match', async () => {
    // Two partners who both left the tax code empty are not the same person.
    const blank = {
      ...REGISTERED,
      taxCode: '',
      bankAccountNumber: '',
    } as unknown as PartnerEntity;
    const service = buildDetector({
      buyer: { id: 200, email: 'khach@example.com' },
      buyerPartner: {
        id: 9,
        contactEmail: 'khach@example.com',
        taxCode: '',
        bankAccountNumber: null,
      } as Partial<PartnerEntity>,
    });

    await expect(
      service.detectSelfReferral(blank, { orderId: 1, buyerUserId: 200 }),
    ).resolves.toBeNull();
  });

  it('should pay the partner when the check itself could not run', async () => {
    // Not knowing is not a reason to withhold somebody commission.
    const service = buildDetector({});
    Object.assign(service, {
      userRepository: {
        findOne: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });

    await expect(
      service.detectSelfReferral(REGISTERED, { orderId: 1, buyerUserId: 200 }),
    ).resolves.toBeNull();
  });

  it('should have nothing to compare for a guest checkout with no invoice', async () => {
    const service = buildDetector({});

    await expect(
      service.detectSelfReferral(REGISTERED, { orderId: 1, buyerUserId: null }),
    ).resolves.toBeNull();
  });
});

describe('PartnersService.createPendingCommissionForOrder — the refusal is recorded (#041)', () => {
  function buildForCommission(reason: CommissionRejectionReasonEnum | null) {
    const save = jest.fn().mockImplementation((row) => Promise.resolve(row));
    const service = Object.create(PartnersService.prototype) as PartnersService;
    Object.assign(service, {
      logger: { warn: jest.fn(), error: jest.fn() },
      partnerRepository: { findOne: jest.fn().mockResolvedValue(REGISTERED) },
      tierRepository: {
        findOne: jest.fn().mockResolvedValue({ commissionPercent: 10 }),
      },
      commissionRepository: { save, create: (row: unknown) => row },
      detectSelfReferral: jest.fn().mockResolvedValue(reason),
    });
    return { service, save };
  }

  it('should write a 0d rejected row naming the detail that matched', async () => {
    const { service, save } = buildForCommission(
      CommissionRejectionReasonEnum.SELF_EMAIL,
    );

    await expect(
      service.createPendingCommissionForOrder({
        orderId: 1,
        partnerId: 8,
        linkId: 11,
        orderValueVnd: 1_000_000,
        buyerUserId: 200,
      }),
    ).resolves.toMatchObject({
      commissionVnd: 0,
      status: OrderPartnerCommissionStatusEnum.REJECTED,
      rejectionReason: CommissionRejectionReasonEnum.SELF_EMAIL,
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('should pay the commission as usual for an ordinary order', async () => {
    const { service } = buildForCommission(null);

    await expect(
      service.createPendingCommissionForOrder({
        orderId: 1,
        partnerId: 8,
        linkId: 11,
        orderValueVnd: 1_000_000,
        buyerUserId: 200,
      }),
    ).resolves.toMatchObject({
      commissionVnd: 100_000,
      status: OrderPartnerCommissionStatusEnum.PENDING,
    });
  });
});
