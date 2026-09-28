import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PartnerTierEvaluationEntity } from './infrastructure/persistence/relational/entities/partner-tier-evaluation.entity';
import {
  PARTNER_CARD_TOPUP_FEE_PERCENT,
  PARTNER_DEPOSIT_MAX_VND,
  PARTNER_DEPOSIT_MIN_VND,
  PARTNER_DEPOSIT_REF_PREFIX,
  PARTNER_PAYOUT_MIN_VND,
} from './partners.constants';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { partnerDeviceFingerprint } from './partner-device-fingerprint';
import * as ExcelJS from 'exceljs';
import { In, DataSource, EntityManager, MoreThan, Repository } from 'typeorm';
import { AllConfigType } from '../config/config.type';
import { MailService } from '../mail/mail.service';
import { OnepayService } from '../payment/onepay.service';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import {
  buildVietQrUrl,
  generateBankTransferCode,
} from '../payment/bank-transfer.util';
import { PartnerEntity } from './infrastructure/persistence/relational/entities/partner.entity';
import { PartnerWalletEntity } from './infrastructure/persistence/relational/entities/partner-wallet.entity';
import { PartnerWalletTransactionEntity } from './infrastructure/persistence/relational/entities/partner-wallet-transaction.entity';
import { PartnerDepositRequestEntity } from './infrastructure/persistence/relational/entities/partner-deposit-request.entity';
import { PartnerTierEntity } from './infrastructure/persistence/relational/entities/partner-tier.entity';
import { PartnerLinkEntity } from './infrastructure/persistence/relational/entities/partner-link.entity';
import { PartnerLinkClickEntity } from './infrastructure/persistence/relational/entities/partner-link-click.entity';
import { OrderPartnerCommissionEntity } from './infrastructure/persistence/relational/entities/order-partner-commission.entity';
import { PartnerPayoutEntity } from './infrastructure/persistence/relational/entities/partner-payout.entity';
import { CouponEntity } from '../coupons/infrastructure/persistence/relational/entities/coupon.entity';
import { PartnerMemberAttributionEntity } from './infrastructure/persistence/relational/entities/partner-member-attribution.entity';
import { PartnerSessionEventEntity } from './infrastructure/persistence/relational/entities/partner-session-event.entity';
import { PartnerStatusChangeEntity } from './infrastructure/persistence/relational/entities/partner-status-change.entity';
import {
  AdminCreatePartnerDto,
  PartnerApplyDto,
} from './dto/partner-apply.dto';
import { CreatePartnerCouponDto } from './dto/partner-coupon.dto';
import { UpdatePartnerProfileDto } from './dto/update-partner-profile.dto';
import { RequestBankAccountChangeDto } from './dto/partner-bank-account.dto';
import {
  QueryPartnerDto,
  QueryPartnerCommissionDto,
} from './dto/query-partner.dto';
import {
  AdjustPartnerWalletDto,
  AssignPartnerTierDto,
  BulkPartnerStatusDto,
  CreateDepositRequestDto,
  CreatePartnerPayoutDto,
  RejectPartnerDto,
  UpdatePartnerProfileByAdminDto,
  UpdatePartnerStatusDto,
} from './dto/admin-partner.dto';
import {
  CreatePartnerLinkDto,
  UpdatePartnerLinkDto,
} from './dto/partner-link.dto';
import {
  PartnerOrderRowDto,
  type PartnerOrderInvalidReason,
  type PartnerOrderValidity,
} from './dto/partner-order-row.dto';
import {
  CreatePartnerTierDto,
  UpdatePartnerTierDto,
} from './dto/partner-tier.dto';
import {
  CommissionRejectionReasonEnum,
  OrderPartnerCommissionStatusEnum,
  PartnerDepositRequestStatusEnum,
  PartnerLinkStatusEnum,
  PartnerPayoutStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
  PartnerWalletStatusEnum,
  PartnerTopupMethodEnum,
  PartnerWalletTransactionTypeEnum,
  SessionEventTypeEnum,
  SessionShapeEnum,
  PARTNER_LINK_ATTRIBUTION_DAYS,
} from './partners.enum';

/**
 * What a partner needs in order to pay (#047).
 *
 * One shape for both methods: a transfer gets a QR and the account to send to, a
 * card gets a URL to open. The three amounts are always there, because the
 * amount paid and the amount credited are different numbers for a card.
 */
export type PartnerTopupInstruction = {
  id: number;
  amountVnd: number;
  feeVnd: number;
  creditedVnd: number;
  method: PartnerTopupMethodEnum;
  bankTransferCode: string;
  status: PartnerDepositRequestStatusEnum;
  /** Bank transfer only. */
  qrUrl?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  /** Card only. */
  paymentUrl?: string;
  paymentRef?: string;
};

type WalletTransactionInput = {
  sourceType?: string | null;
  sourceId?: string | null;
  orderId?: number | null;
  idempotencyKey?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdByAdminId?: number | null;
};

/**
 * One-line rendering of a partner's saved payout account, used when a
 * withdrawal request does not carry its own account details.
 */
function formatPartnerBankAccount(partner: {
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
}): string | null {
  const parts = [
    partner.bankName,
    partner.bankAccountNumber,
    partner.bankAccountHolder,
    partner.bankBranch,
  ].filter((v): v is string => !!v && v.trim().length > 0);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** An admin list row: the partner plus the numbers the console triages on. */
type AdminPartnerListRow = PartnerEntity & {
  walletBalanceVnd: number;
  /** Balance less anything already claimed and waiting to be paid (#060). */
  availableBalanceVnd: number;
  revenue30dVnd: number;
  /**
   * When the partner last signed in (#060) — the brief's "hoạt động gần nhất".
   * Falls back to their last order for accounts that predate the column.
   */
  lastActivityAt: Date | null;
  lastLoginAt: Date | null;
  lastOrderAt: Date | null;
  /** Lifetime paid/completed orders attributed to this partner (#095). */
  totalOrders: number;
  /** Lifetime value of those orders. */
  totalRevenueVnd: number;
  /** Revenue less cost of goods less what we paid the partner. */
  profitVnd: number;
  /** Lifetime commission credited to this partner — what we have paid them. */
  totalCommissionVnd: number;
  /** Share of their orders that ended up refunded, 0–100 by order count. */
  refundRatePercent: number;
};

/** What an admin needs to see about the affiliate behind an order (#095). */
export interface OrderPartnerCommissionSummary {
  partnerId: number;
  partnerName: string | null;
  partnerStatus: string | null;
  /** The link the buyer arrived through, when the order came from one. */
  linkCode: string | null;
  commissionVnd: number;
  status: string;
  /** Why a `rejected` commission earned nothing — see #041. */
  rejectionReason: string | null;
  tierSnapshot: string | null;
  /** The rate this commission was worked out at, when it is known (#042). */
  commissionPercentSnapshot: number | null;
  createdAt: Date;
}
/** Order states that will never pay a commission, however they got here. */
/** Orders that only top up an eSIM the customer already has (#025). */
const TOPUP_ORDER_TYPE = 'TOPUP';

/**
 * Comparisons for the self-referral check (#041).
 *
 * Written down rather than inlined because the whole check turns on them: a
 * partner who registered `+84 901 234 567` and ordered as `0901234567` is the
 * same person, and a check that missed it would be no check at all.
 */
function sameEmail(a?: string | null, b?: string | null): boolean {
  const left = a?.trim().toLowerCase();
  const right = b?.trim().toLowerCase();
  return Boolean(left && right && left === right);
}

/** Vietnamese numbers, written any of the usual ways: 0901…, +84901…, 84901… */
function normalisePhone(value?: string | null): string | null {
  const digits = value?.replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;
  const national = digits.startsWith('84') ? digits.slice(2) : digits;
  return national.replace(/^0+/, '');
}

function samePhone(a?: string | null, b?: string | null): boolean {
  const left = normalisePhone(a);
  const right = normalisePhone(b);
  return Boolean(left && right && left === right);
}

/** Tax codes and account numbers: spaces and dashes are decoration. */
function sameDigits(a?: string | null, b?: string | null): boolean {
  const left = a?.replace(/\D/g, '');
  const right = b?.replace(/\D/g, '');
  return Boolean(left && right && left.length >= 6 && left === right);
}

/**
 * What one attributed order is worth to the partner (#020).
 *
 * `vndPrice` is only the part the customer paid with money: an order settled
 * from their eXU wallet has `vndPrice = 0`, which is why the partner's order
 * list showed 0đ. `eligibleSpendVnd` is the order value after discounts and
 * before the wallet spend — the very base the commission is calculated from,
 * so revenue and commission on the same row now agree with each other.
 */
const ORDER_REVENUE_SQL = `COALESCE(NULLIF(o."eligibleSpendVnd", 0), NULLIF(o."payableVndPrice" + o."walletSpentVndAmount", 0), o."vndPrice")`;

/**
 * How long an affiliate order sits as "Chờ xác nhận" before the commission is
 * approved (#019) — the window in which customers cancel or ask for a refund.
 */
const COMMISSION_HOLD_HOURS = 24;

/** How long an emailed bank-change code stays good, and how hard it may be guessed (#005). */
const BANK_CHANGE_OTP_TTL_MS = 10 * 60 * 1000;
const BANK_CHANGE_OTP_RESEND_MS = 60 * 1000;
const BANK_CHANGE_OTP_MAX_ATTEMPTS = 5;

/**
 * Day bounds for the dashboard window (#010).
 *
 * `to` is pushed to the start of the next day so the last day counts in full —
 * an order placed at 16:00 today belongs to "Hôm nay".
 */
function resolveSummaryRange(range: { from?: string; to?: string }): {
  from: Date;
  to: Date;
} {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const parsed = (value?: string) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const fromInput = parsed(range.from);
  const toInput = parsed(range.to);

  if (!fromInput) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    return { from: thirtyDaysAgo, to: new Date(now.getTime() + 1000) };
  }

  const from = startOfDay(fromInput);
  const end = startOfDay(toInput ?? fromInput);
  end.setDate(end.getDate() + 1);
  return { from, to: end };
}

/**
 * Growth against the same period last month, as a whole percent (#008).
 *
 * With nothing to compare against, a first month of earnings is not "+∞%": it
 * reads as 100% when there is something now and 0% when there is not.
 */
function growthPercent(current: number, previous: number): number {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  return current > 0 ? 100 : 0;
}

/** `thu.ha@esim.vn` -> `th***@esim.vn`, so the portal can say where it went. */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const head = name.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

const DEAD_ORDER_STATUS_LIST = ['cancelled', 'failed', 'refunded'];
const DEAD_ORDER_STATUSES = new Set(DEAD_ORDER_STATUS_LIST);

/** Order states where the money has actually arrived. */
const SETTLED_ORDER_STATUS_LIST = ['paid', 'completed'];
const SETTLED_ORDER_STATUSES = new Set(SETTLED_ORDER_STATUS_LIST);

/**
 * Is this order one the partner gets paid for (#095, ý 3)?
 *
 * The partner's own order list showed every attributed order the same way, so
 * a cancelled order and a credited one looked identical and the totals never
 * matched what landed in the wallet. Three outcomes, because two would lie:
 * an order still on its way is not a rejection, and saying so avoids a support
 * message every time an order is paid before the commission is reconciled.
 */
export function classifyPartnerOrder(
  orderStatus: string | null | undefined,
  commissionStatus: string | null | undefined,
  isSelfReferral = false,
): {
  validity: PartnerOrderValidity;
  invalidReason: PartnerOrderInvalidReason | null;
} {
  // Said first, because "đơn không phát sinh hoa hồng" would leave the partner
  // wondering; this one has a reason they can act on.
  //
  // A `rejected` commission is the same verdict reached from the other side:
  // the buyer's details matched the partner's own registration, and the row
  // records which one (#041).
  if (
    isSelfReferral ||
    commissionStatus === OrderPartnerCommissionStatusEnum.REJECTED
  ) {
    return { validity: 'invalid', invalidReason: 'self_referral' };
  }
  if (commissionStatus === OrderPartnerCommissionStatusEnum.REVERSED) {
    return { validity: 'invalid', invalidReason: 'commission_reversed' };
  }
  if (orderStatus && DEAD_ORDER_STATUSES.has(orderStatus)) {
    return { validity: 'invalid', invalidReason: 'order_cancelled' };
  }
  // Attributed but no commission row: the tier paid 0%, or the order was
  // ruled out. Either way the partner earns nothing and should be told.
  if (!commissionStatus) {
    return { validity: 'invalid', invalidReason: 'no_commission' };
  }
  if (
    commissionStatus === OrderPartnerCommissionStatusEnum.CREDITED &&
    orderStatus &&
    SETTLED_ORDER_STATUSES.has(orderStatus)
  ) {
    return { validity: 'valid', invalidReason: null };
  }
  return { validity: 'pending', invalidReason: null };
}

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService<AllConfigType>,
    @InjectRepository(PartnerEntity)
    private readonly partnerRepository: Repository<PartnerEntity>,
    @InjectRepository(PartnerWalletEntity)
    private readonly walletRepository: Repository<PartnerWalletEntity>,
    @InjectRepository(PartnerWalletTransactionEntity)
    private readonly transactionRepository: Repository<PartnerWalletTransactionEntity>,
    @InjectRepository(PartnerDepositRequestEntity)
    private readonly depositRequestRepository: Repository<PartnerDepositRequestEntity>,
    @InjectRepository(PartnerTierEntity)
    private readonly tierRepository: Repository<PartnerTierEntity>,
    @InjectRepository(PartnerLinkEntity)
    private readonly linkRepository: Repository<PartnerLinkEntity>,
    @InjectRepository(PartnerLinkClickEntity)
    private readonly linkClickRepository: Repository<PartnerLinkClickEntity>,
    @InjectRepository(OrderPartnerCommissionEntity)
    private readonly commissionRepository: Repository<OrderPartnerCommissionEntity>,
    @InjectRepository(PartnerPayoutEntity)
    private readonly payoutRepository: Repository<PartnerPayoutEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(PartnerTierEvaluationEntity)
    private readonly tierEvaluationRepository: Repository<PartnerTierEvaluationEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
    @InjectRepository(PartnerMemberAttributionEntity)
    private readonly memberAttributionRepository: Repository<PartnerMemberAttributionEntity>,
    @InjectRepository(PartnerSessionEventEntity)
    private readonly sessionEventRepository: Repository<PartnerSessionEventEntity>,
    @InjectRepository(PartnerStatusChangeEntity)
    private readonly statusChangeRepository: Repository<PartnerStatusChangeEntity>,
    private readonly mailService: MailService,
    /**
     * Only to build a payment URL for a card top-up (#047). Provided directly
     * in this module rather than importing PaymentModule, which would close a
     * cycle back through OrdersModule.
     */
    private readonly onepayService: OnepayService,
  ) {}

  /**
   * Mail an applicant the outcome, without letting the mail server decide
   * whether the decision itself stands (#095).
   *
   * The applicant is already approved or rejected in the database by the time
   * this runs; a timeout or a missing template must not turn that into a 500
   * for the admin who clicked the button, so the failure is logged and dropped.
   */
  private notifyPartnerDecision(
    partner: PartnerEntity,
    outcome: 'approved' | 'rejected',
  ): void {
    if (!partner.contactEmail) return;

    const send =
      outcome === 'approved'
        ? this.mailService.sendPartnerApproved({
            to: partner.contactEmail,
            contactName: partner.contactName,
          })
        : this.mailService.sendPartnerRejected({
            to: partner.contactEmail,
            contactName: partner.contactName,
            reason: partner.rejectionReason,
          });

    void send.catch((error) => {
      this.logger.error(
        `Failed to send partner ${outcome} email to ${partner.contactEmail}: ${error}`,
      );
    });
  }

  // ───────────────────────── Registration ─────────────────────────

  async apply(
    dto: PartnerApplyDto,
  ): Promise<{ partnerId: number; userId: number }> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.contactEmail },
    });
    if (existing) {
      const rejected = await this.partnerRepository.findOne({
        where: {
          userId: existing.id,
          status: PartnerStatusEnum.REJECTED,
        },
      });

      // The rejection email tells the applicant to fill the form in again, so
      // their own email must be accepted a second time (#003). The profile is
      // rewritten with what they just sent and goes back in the queue.
      if (rejected) {
        return this.reapply(existing.id, rejected, dto);
      }

      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { contactEmail: 'emailAlreadyExists' },
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash(dto.password, salt);

      const userRepo = manager.getRepository(UserEntity);
      const user = await userRepo.save(
        userRepo.create({
          email: dto.contactEmail,
          password,
          provider: 'email',
          firstName: dto.contactName,
          lastName: null,
          phoneNumber: dto.contactPhone,
          role: { id: RoleEnum.partner } as UserEntity['role'],
          status: { id: StatusEnum.inactive } as UserEntity['status'],
        }),
      );

      const partnerRepo = manager.getRepository(PartnerEntity);
      const partner = await partnerRepo.save(
        partnerRepo.create({
          userId: user.id,
          partnerType: dto.partnerType,
          legalType: dto.legalType,
          companyName: dto.companyName ?? null,
          taxCode: dto.taxCode ?? null,
          businessAddress: dto.businessAddress ?? null,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          channelInfo: dto.channelInfo ?? null,
          status: PartnerStatusEnum.PENDING,
          notes: dto.notes ?? null,
        }),
      );

      const walletRepo = manager.getRepository(PartnerWalletEntity);
      await walletRepo.save(
        walletRepo.create({
          partnerId: partner.id,
          balanceVnd: 0,
          status: PartnerWalletStatusEnum.ACTIVE,
        }),
      );

      return { partnerId: partner.id, userId: user.id };
    });
  }

  /**
   * Second attempt after a rejection (#003).
   *
   * Everything the applicant just filled in replaces what was on file, the
   * rejection reason is cleared so the admin reviews a clean profile, and the
   * password they typed becomes their login — they may well have forgotten the
   * one from the first attempt.
   */
  private async reapply(
    userId: number,
    partner: PartnerEntity,
    dto: PartnerApplyDto,
  ): Promise<{ partnerId: number; userId: number }> {
    return this.dataSource.transaction(async (manager) => {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash(dto.password, salt);

      await manager.getRepository(UserEntity).update(userId, {
        password,
        firstName: dto.contactName,
        phoneNumber: dto.contactPhone,
      });

      const partnerRepo = manager.getRepository(PartnerEntity);
      await partnerRepo.save(
        partnerRepo.merge(partner, {
          partnerType: dto.partnerType,
          legalType: dto.legalType,
          companyName: dto.companyName ?? null,
          taxCode: dto.taxCode ?? null,
          businessAddress: dto.businessAddress ?? null,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          channelInfo: dto.channelInfo ?? null,
          status: PartnerStatusEnum.PENDING,
          notes: dto.notes ?? null,
          rejectionReason: null,
        }),
      );

      return { partnerId: partner.id, userId };
    });
  }

  // ───────────────────────── Self-service ─────────────────────────

  async getPartnerByUserId(userId: number): Promise<PartnerEntity> {
    const partner = await this.partnerRepository.findOne({ where: { userId } });
    if (!partner) {
      throw new NotFoundException('Bạn chưa có hồ sơ đối tác.');
    }
    return partner;
  }

  async updateMyProfile(
    userId: number,
    dto: UpdatePartnerProfileDto,
  ): Promise<PartnerEntity> {
    const partner = await this.getPartnerByUserId(userId);
    Object.assign(partner, {
      ...(dto.contactName !== undefined && { contactName: dto.contactName }),
      ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
      ...(dto.companyName !== undefined && { companyName: dto.companyName }),
      ...(dto.taxCode !== undefined && { taxCode: dto.taxCode }),
      ...(dto.businessAddress !== undefined && {
        businessAddress: dto.businessAddress,
      }),
      ...(dto.channelInfo !== undefined && { channelInfo: dto.channelInfo }),
      ...(dto.brandInfo !== undefined && { brandInfo: dto.brandInfo }),
    });
    // Bank details deliberately absent: they move through the emailed code
    // (#005), see requestBankAccountChange / confirmBankAccountChange.
    return this.partnerRepository.save(partner);
  }

  /**
   * Step one of changing where the money goes (#005).
   *
   * The new account is parked on the partner row with the hash of a six-digit
   * code mailed to the address on file. Nothing about the live account changes
   * yet, so someone who gets hold of a session still cannot redirect a payout
   * without also reading the partner's inbox.
   */
  async requestBankAccountChange(
    userId: number,
    dto: RequestBankAccountChangeDto,
  ): Promise<{ sentTo: string; expiresAt: string }> {
    const partner = await this.getPartnerByUserId(userId);

    if (!partner.contactEmail) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { contactEmail: 'Hồ sơ chưa có email để nhận mã xác nhận.' },
      });
    }

    const pending = partner.pendingBankChange;
    if (
      pending &&
      Date.now() - new Date(pending.requestedAt).getTime() <
        BANK_CHANGE_OTP_RESEND_MS
    ) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { otp: 'otpRecentlySent' },
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + BANK_CHANGE_OTP_TTL_MS);

    partner.pendingBankChange = {
      values: {
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        bankAccountHolder: dto.bankAccountHolder,
        bankBranch: dto.bankBranch ?? null,
      },
      otpHash: await bcrypt.hash(otp, 10),
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
      requestedAt: new Date().toISOString(),
    };
    await this.partnerRepository.save(partner);

    await this.mailService.sendPartnerBankChangeOtp({
      to: partner.contactEmail,
      contactName: partner.contactName,
      otp,
      bankSummary: `${dto.bankName} — ${dto.bankAccountNumber} — ${dto.bankAccountHolder}`,
      expiresInMinutes: Math.round(BANK_CHANGE_OTP_TTL_MS / 60000),
    });

    return {
      sentTo: maskEmail(partner.contactEmail),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** Step two: the code releases exactly the account that was requested (#005). */
  async confirmBankAccountChange(
    userId: number,
    otp: string,
  ): Promise<PartnerEntity> {
    const partner = await this.getPartnerByUserId(userId);
    const pending = partner.pendingBankChange;

    if (!pending) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { otp: 'otpNotFound' },
      });
    }

    if (Date.now() > new Date(pending.expiresAt).getTime()) {
      partner.pendingBankChange = null;
      await this.partnerRepository.save(partner);
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { otp: 'otpExpired' },
      });
    }

    if (pending.attempts >= BANK_CHANGE_OTP_MAX_ATTEMPTS) {
      partner.pendingBankChange = null;
      await this.partnerRepository.save(partner);
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { otp: 'otpMaxAttemptsExceeded' },
      });
    }

    if (!(await bcrypt.compare(otp, pending.otpHash))) {
      partner.pendingBankChange = {
        ...pending,
        attempts: pending.attempts + 1,
      };
      await this.partnerRepository.save(partner);
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { otp: 'otpInvalid' },
      });
    }

    partner.bankName = pending.values.bankName;
    partner.bankAccountNumber = pending.values.bankAccountNumber;
    partner.bankAccountHolder = pending.values.bankAccountHolder;
    partner.bankBranch = pending.values.bankBranch;
    partner.pendingBankChange = null;

    return this.partnerRepository.save(partner);
  }

  /**
   * The partner's money, in the three buckets the brief names (#095, ý 2):
   * "Chờ đối soát - Khả dụng - Đã rút luỹ kế".
   *
   * Only two of them existed. `pendingPayoutVnd` is money already claimed in a
   * withdrawal request, which is a different thing from commission that has not
   * been reconciled yet — a partner reading the old summary could see 0đ while
   * having millions in unreconciled commission, and reasonably conclude the
   * programme had not paid them for anything.
   */
  async getWalletSummaryForPartner(partnerId: number) {
    const wallet = await this.getOrCreateWallet(partnerId);
    const [pendingPayouts, pendingCommissions, paidPayouts] = await Promise.all(
      [
        this.payoutRepository
          .createQueryBuilder('payout')
          .select('COALESCE(SUM(payout.amountVnd), 0)', 'sum')
          .where('payout.partnerId = :partnerId', { partnerId })
          .andWhere('payout.status = :status', {
            status: PartnerPayoutStatusEnum.PENDING,
          })
          .getRawOne<{ sum: string }>(),
        // Earned but not yet credited: the order is done, reconciliation is not.
        this.commissionRepository
          .createQueryBuilder('commission')
          .select('COALESCE(SUM(commission.commissionVnd), 0)', 'sum')
          .where('commission.partnerId = :partnerId', { partnerId })
          .andWhere('commission.status = :status', {
            status: OrderPartnerCommissionStatusEnum.PENDING,
          })
          .getRawOne<{ sum: string }>(),
        // Lifetime paid out, so the partner can reconcile against their bank —
        // with the number of payments behind it (#029).
        this.payoutRepository
          .createQueryBuilder('payout')
          .select('COALESCE(SUM(payout.amountVnd), 0)', 'sum')
          .addSelect('COUNT(*)', 'count')
          .where('payout.partnerId = :partnerId', { partnerId })
          .andWhere('payout.status = :status', {
            status: PartnerPayoutStatusEnum.PAID,
          })
          .getRawOne<{ sum: string; count: string }>(),
      ],
    );

    const balanceVnd = Number(wallet.balanceVnd);
    const pendingPayoutVnd = Number(pendingPayouts?.sum ?? 0);

    return {
      balanceVnd,
      availableBalanceVnd: Math.max(0, balanceVnd - pendingPayoutVnd),
      /**
       * Commission clawed back after it was already paid out, shown as a debt
       * rather than hidden behind a floored available balance (#007): the next
       * commissions pay it off before anything becomes withdrawable again.
       */
      carriedDebtVnd: Math.max(0, -balanceVnd),
      pendingPayoutVnd,
      /** Commission earned but still awaiting reconciliation. */
      pendingCommissionVnd: Number(pendingCommissions?.sum ?? 0),
      /** Lifetime total actually paid out. */
      withdrawnVnd: Number(paidPayouts?.sum ?? 0),
      /** How many payments that was, for "từ N lần thanh toán" (#029). */
      payoutCount: Number(paidPayouts?.count ?? 0),
      status: wallet.status,
      /**
       * The rules the top-up screen has to state, from the one place they are
       * declared, so the form and the server cannot disagree (#047).
       */
      topupPolicy: {
        ...this.depositLimitsFor(await this.getPartnerOrThrowById(partnerId)),
        cardFeePercent: PARTNER_CARD_TOPUP_FEE_PERCENT,
      },
    };
  }

  async getWalletTransactions(partnerId: number, limit = 50) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.transactionRepository.find({
      where: { partnerId },
      order: { createdAt: 'DESC' },
      take,
    });
  }

  /**
   * May this partner run the affiliate programme (#048)?
   *
   * A marketing partner is the affiliate programme. A distribution partner buys
   * stock, and only earns commission as well when esim.vn has granted it.
   */
  private assertMayAffiliate(partner: PartnerEntity, what: string): void {
    if (partner.partnerType === PartnerTypeEnum.KOL) return;
    if (partner.canAffiliate) return;
    throw new BadRequestException(
      `Tài khoản của bạn chưa được cấp quyền tiếp thị nên không dùng được ${what}. Liên hệ esim.vn nếu bạn muốn tham gia chương trình tiếp thị.`,
    );
  }

  async createDepositRequest(
    partnerId: number,
    dto: CreateDepositRequestDto,
  ): Promise<PartnerTopupInstruction> {
    // A marketing partner has nothing to deposit against — they earn
    // commission, they do not buy stock (#013). The portal hides the screen;
    // this is the rule itself, so a stale tab or a direct call cannot open a
    // deposit request that would never be spent.
    const partner = await this.getPartnerOrThrowById(partnerId);
    if (partner.partnerType === PartnerTypeEnum.KOL) {
      throw new BadRequestException(
        'Đối tác tiếp thị không dùng ví ký quỹ. Thu nhập của bạn là hoa hồng, rút ở mục Rút tiền.',
      );
    }

    const sepay = this.configService.get('sepay', { infer: true });
    if (!sepay?.accountNumber) {
      throw new BadRequestException(
        'Chưa cấu hình tài khoản nhận chuyển khoản (SEPAY_ACCOUNT_NUMBER).',
      );
    }

    const amountVnd = Math.round(dto.amountVnd);
    // This partner's own limits when they have been given any, the programme
    // default otherwise (#061).
    const limits = this.depositLimitsFor(partner);
    if (amountVnd < limits.minVnd) {
      throw new BadRequestException(
        `Số tiền nạp tối thiểu là ${limits.minVnd.toLocaleString('vi-VN')}đ.`,
      );
    }
    if (amountVnd > limits.maxVnd) {
      throw new BadRequestException(
        `Số tiền nạp tối đa mỗi lần là ${limits.maxVnd.toLocaleString('vi-VN')}đ.`,
      );
    }

    const method = dto.method ?? PartnerTopupMethodEnum.BANK_TRANSFER;
    // A card payment goes through OnePay, which charges for it, and the brief
    // puts that cost on the partner: 100.000đ sent by card credits 94.000đ
    // (#047). A transfer costs nothing and is credited in full.
    const feeVnd =
      method === PartnerTopupMethodEnum.CARD
        ? Math.round((amountVnd * PARTNER_CARD_TOPUP_FEE_PERCENT) / 100)
        : 0;
    const creditedVnd = amountVnd - feeVnd;

    const bankTransferCode = generateBankTransferCode();
    const request = await this.depositRequestRepository.save(
      this.depositRequestRepository.create({
        partnerId,
        amountVnd,
        method,
        feeVnd,
        creditedVnd,
        bankTransferCode,
        status: PartnerDepositRequestStatusEnum.PENDING,
      }),
    );

    const common = {
      id: request.id,
      amountVnd,
      feeVnd,
      creditedVnd,
      method,
      bankTransferCode,
      status: request.status,
    };

    if (method === PartnerTopupMethodEnum.CARD) {
      // The reference carries the row id so the IPN can find it without a
      // lookup table, and the prefix tells it apart from an order (#047).
      const paymentRef = `${PARTNER_DEPOSIT_REF_PREFIX}-${request.id}-${bankTransferCode}`;
      const paymentUrl = this.onepayService.buildPaymentUrl({
        orderNumber: paymentRef,
        vndAmount: amountVnd,
        clientIp: '127.0.0.1',
        orderInfo: `Nap ky quy doi tac #${partnerId}`,
        title: 'Nạp ký quỹ đối tác',
        cardList: 'INTERNATIONAL',
      });
      return { ...common, paymentRef, paymentUrl };
    }

    const qrUrl = buildVietQrUrl({
      bankCode: sepay.bankCode,
      accountNumber: sepay.accountNumber,
      accountName: sepay.accountName,
      amountVnd,
      transferCode: bankTransferCode,
    });

    return {
      ...common,
      qrUrl,
      accountNumber: sepay.accountNumber,
      accountName: sepay.accountName,
      bankCode: sepay.bankCode,
    };
  }

  /**
   * Credit a card top-up once OnePay says the payment went through (#047).
   *
   * Idempotent, like the SePay path: OnePay redelivers its notification, and a
   * partner reloading the return page must not top up twice.
   */
  async confirmCardTopupByOnePay(
    paymentRef: string,
    paymentId: string | null,
    isSuccess: boolean,
  ): Promise<PartnerDepositRequestEntity | null> {
    const id = Number(paymentRef.split('-')[1]);
    if (!Number.isInteger(id) || id <= 0) return null;

    const request = await this.depositRequestRepository.findOne({
      where: { id },
    });
    if (!request) return null;
    if (request.status !== PartnerDepositRequestStatusEnum.PENDING) {
      return request;
    }

    if (!isSuccess) {
      request.status = PartnerDepositRequestStatusEnum.CANCELLED;
      request.paymentId = paymentId;
      return this.depositRequestRepository.save(request);
    }

    request.paymentId = paymentId;
    return this.creditDepositRequest(request, {
      adminId: null,
      reason: `Nạp ký quỹ qua thẻ (OnePay), phí ${PARTNER_CARD_TOPUP_FEE_PERCENT}%`,
      metadata: paymentId ? { onepayTransactionNo: paymentId } : undefined,
    });
  }

  async getMyDepositRequests(partnerId: number) {
    return this.depositRequestRepository.find({
      where: { partnerId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async getMyLinks(partnerId: number) {
    return this.linkRepository.find({
      where: { partnerId },
      order: { createdAt: 'DESC' },
    });
  }

  async createLink(partnerId: number, dto: CreatePartnerLinkDto) {
    const partner = await this.partnerRepository.findOne({
      where: { id: partnerId },
    });
    if (!partner) {
      throw new ForbiddenException('Không tìm thấy đối tác.');
    }
    // A distribution partner may create links too, once esim.vn has granted
    // them the affiliate programme (#048).
    this.assertMayAffiliate(partner, 'link tiếp thị');

    // A memorable code is the whole point when it has to be read aloud in a
    // video, but it is a privilege an admin grants per partner (#014) — every
    // good short name would otherwise be taken within a week. A taken code is
    // reported as such instead of being silently swapped for a random string.
    if (dto.code) {
      if (!partner.canCustomLinkCode) {
        throw new ForbiddenException(
          'Tài khoản của bạn chưa được cấp quyền đặt tên link tiếp thị. Hệ thống sẽ tạo mã ngẫu nhiên, liên hệ hỗ trợ nếu bạn cần tên riêng cho chiến dịch.',
        );
      }

      const code = dto.code.trim().toUpperCase();
      const taken = await this.linkRepository.findOne({
        where: { code },
        withDeleted: true,
      });
      if (taken) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { code: 'Mã giới thiệu này đã có người dùng.' },
        });
      }

      return this.linkRepository.save(
        this.linkRepository.create({
          partnerId,
          code,
          label: dto.label,
          targetPath: dto.targetPath ?? null,
          status: PartnerLinkStatusEnum.ACTIVE,
        }),
      );
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateLinkCode();
      try {
        return await this.linkRepository.save(
          this.linkRepository.create({
            partnerId,
            code,
            label: dto.label,
            targetPath: dto.targetPath ?? null,
            status: PartnerLinkStatusEnum.ACTIVE,
          }),
        );
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }
    throw new BadRequestException('Không thể tạo mã link, vui lòng thử lại.');
  }

  async updateLink(
    partnerId: number,
    linkId: number,
    dto: UpdatePartnerLinkDto,
  ) {
    const link = await this.linkRepository.findOne({
      where: { id: linkId, partnerId },
    });
    if (!link) throw new NotFoundException('Không tìm thấy link.');

    Object.assign(link, {
      ...(dto.label !== undefined && { label: dto.label }),
      ...(dto.targetPath !== undefined && { targetPath: dto.targetPath }),
      ...(dto.isActive !== undefined && {
        status: dto.isActive
          ? PartnerLinkStatusEnum.ACTIVE
          : PartnerLinkStatusEnum.INACTIVE,
      }),
    });
    return this.linkRepository.save(link);
  }

  /**
   * The partner's links as a spreadsheet (#017).
   *
   * Same columns they see on screen, so a partner reconciling a campaign in
   * Excel is looking at the same numbers as the portal — commission included is
   * already net of orders that were refunded or cancelled.
   */
  async exportMyLinksToExcel(partnerId: number): Promise<Buffer> {
    const links = await this.linkRepository.find({
      where: { partnerId },
      order: { createdAt: 'DESC' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'esim.vn';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Link tiếp thị');
    sheet.columns = [
      { header: 'Tên chiến dịch', key: 'label', width: 32 },
      { header: 'Trang đích', key: 'landing', width: 32 },
      { header: 'Link tiếp thị', key: 'link', width: 30 },
      { header: 'Số lượt click', key: 'clicks', width: 14 },
      { header: 'Tổng đơn hàng', key: 'orders', width: 14 },
      { header: 'Tổng hoa hồng (VND)', key: 'commission', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const link of links) {
      sheet.addRow({
        label: link.label,
        // Without the utm parameters the portal appends, which are noise in a
        // column meant to answer "where does this link send people".
        landing: (link.targetPath ?? '').split('?')[0] || 'Trang chủ',
        link: `esim.vn/go/${link.code}`,
        clicks: Number(link.clickCount ?? 0),
        orders: Number(link.conversionCount ?? 0),
        commission: Number(link.totalCommissionVnd ?? 0),
        status:
          link.status === PartnerLinkStatusEnum.ACTIVE
            ? 'Đang hoạt động'
            : 'Đã tắt',
      });
    }

    sheet.getColumn('commission').numFmt = '#,##0';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Retire a link the partner no longer wants (#016).
   *
   * Soft delete on purpose: the code stays reserved and the orders it already
   * brought keep pointing at something, so a reconciliation query months later
   * still says where that commission came from.
   */
  async deleteLink(partnerId: number, linkId: number): Promise<void> {
    const link = await this.linkRepository.findOne({
      where: { id: linkId, partnerId },
    });
    if (!link) throw new NotFoundException('Không tìm thấy link.');

    await this.linkRepository.softRemove(link);
  }

  /**
   * The affiliate commission attached to an order, if any (#095).
   *
   * Admins looking at an order need to see who earned on it and how much —
   * the order list showed only the referral CODE, which says nothing about
   * the partner behind it or what we owe them.
   *
   * The percentage is derived, not stored: the row keeps the dong figure and
   * the tier it was set at, so the share is worked out against the order value
   * the commission was calculated from.
   */
  async getCommissionSummariesByOrderIds(
    orderIds: number[],
  ): Promise<Map<number, OrderPartnerCommissionSummary>> {
    const summaries = new Map<number, OrderPartnerCommissionSummary>();
    if (orderIds.length === 0) return summaries;

    const rows = await this.commissionRepository.find({
      where: { orderId: In(orderIds) },
      relations: { partner: true, link: true },
    });

    for (const row of rows) {
      summaries.set(row.orderId, {
        partnerId: row.partnerId,
        partnerName: row.partner?.contactName ?? null,
        partnerStatus: row.partner?.status ?? null,
        linkCode: row.link?.code ?? null,
        commissionVnd: Number(row.commissionVnd) || 0,
        status: row.status,
        rejectionReason: row.rejectionReason ?? null,
        tierSnapshot: row.tierSnapshot ?? null,
        commissionPercentSnapshot:
          row.commissionPercentSnapshot == null
            ? null
            : Number(row.commissionPercentSnapshot),
        createdAt: row.createdAt,
      });
    }

    return summaries;
  }

  async getCommissionSummaryByOrderId(
    orderId: number,
  ): Promise<OrderPartnerCommissionSummary | null> {
    const summaries = await this.getCommissionSummariesByOrderIds([orderId]);
    return summaries.get(orderId) ?? null;
  }
  async getMyCommissions(partnerId: number, query: QueryPartnerCommissionDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const [data, count] = await this.commissionRepository.findAndCount({
      where: {
        partnerId,
        ...(query.status && {
          status: query.status as OrderPartnerCommissionStatusEnum,
        }),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, totalCount: count };
  }

  async createPayoutRequest(partnerId: number, dto: CreatePartnerPayoutDto) {
    // Withdrawing is part of the affiliate programme: a distributor's ký quỹ
    // balance is there to buy stock with (#048).
    this.assertMayAffiliate(
      await this.getPartnerOrThrowById(partnerId),
      'chức năng rút tiền',
    );

    const summary = await this.getWalletSummaryForPartner(partnerId);
    if (dto.amountVnd > summary.availableBalanceVnd) {
      throw new BadRequestException(
        'Số dư khả dụng không đủ để tạo yêu cầu rút tiền này.',
      );
    }

    // Snapshot the account this payout goes to: the request keeps it even if
    // the partner later edits the account saved on their profile.
    const partner = await this.getPartnerOrThrowById(partnerId);
    const bankAccountInfo =
      dto.bankAccountInfo ?? formatPartnerBankAccount(partner);

    return this.payoutRepository.save(
      this.payoutRepository.create({
        partnerId,
        amountVnd: Math.round(dto.amountVnd),
        bankAccountInfo,
        status: PartnerPayoutStatusEnum.PENDING,
      }),
    );
  }

  async getMyPayouts(partnerId: number) {
    return this.payoutRepository.find({
      where: { partnerId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // ───────────────────────── Admin: partners ─────────────────────────

  async adminList(query: QueryPartnerDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);

    const qb = this.partnerRepository
      .createQueryBuilder('partner')
      .leftJoinAndSelect('partner.user', 'user');

    if (query.partnerType) {
      qb.andWhere('partner.partnerType = :partnerType', {
        partnerType: query.partnerType,
      });
    }
    if (query.status) {
      qb.andWhere('partner.status = :status', { status: query.status });
    }
    if (query.tierCode) {
      qb.andWhere('partner.tierCode = :tierCode', { tierCode: query.tierCode });
    }
    if (query.search) {
      // Phone included because that is what an admin has in front of them when
      // the applicant rings to ask where their approval got to (#055); the id
      // because that is what the reconciliation file quotes back (#058).
      const asId = Number(query.search.trim().replace(/^#/, ''));
      const looksLikeId = Number.isInteger(asId) && asId > 0;
      qb.andWhere(
        `(partner.contactName ILIKE :search OR partner.contactEmail ILIKE :search OR partner.companyName ILIKE :search OR partner.contactPhone ILIKE :search${
          looksLikeId ? ' OR partner.id = :id' : ''
        })`,
        looksLikeId
          ? { search: `%${query.search}%`, id: asId }
          : { search: `%${query.search}%` },
      );
    }

    // "xếp thứ tự theo doanh số cao đến thấp" (#095). The revenue figures are
    // attached after pagination, so ordering has to happen HERE — sorting the
    // page after the fact would look sorted while page 2 held bigger partners
    // than page 1. Newest-first stays as the tie-breaker so partners with no
    // sales yet still appear in a sensible order.
    //
    // The subquery is selected under an alias and ordered by that alias:
    // `orderBy()` given the raw subquery splits it at the first dot and looks
    // for an alias named `(SELECT COALESCE(SUM(o`, failing the whole list.
    // `offset/limit` rather than `skip/take`: `user` is many-to-one, so rows
    // never multiply, and skip/take's distinct-id wrapper cannot see the alias.
    const totalCount = await qb.getCount();
    qb.addSelect(
      `(SELECT COALESCE(SUM(${ORDER_REVENUE_SQL}), 0) FROM "order" o
        WHERE o."attributedPartnerId" = partner.id
          AND o."deletedAt" IS NULL
          AND o.status IN ('paid', 'completed'))`,
      'revenue_sort',
    )
      .orderBy('revenue_sort', 'DESC')
      .addOrderBy('partner.createdAt', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);
    const data = await qb.getMany();

    // The list is an operations screen: 30-day value, money held and last
    // activity are what an admin triages on, so they come back with the row
    // rather than needing a click into each partner.
    const enriched = await this.attachAdminListMetrics(data);

    return {
      data: enriched,
      totalCount,
      hasNextPage: page * limit < totalCount,
    };
  }

  /**
   * The links and discount codes one partner has created (#095).
   *
   * "bấm xem chi tiết đối tác để xem các mã/liên kết đối tác đã tạo" — the admin
   * detail screen showed the partner's contact and company details and nothing
   * about what they are actually promoting with, so an admin investigating a
   * suspicious order or a reconciliation query had no way to see which codes
   * belong to whom without going into the database.
   *
   * Deliberately a separate endpoint rather than more relations on
   * `adminFindById`: that method is also what `approve()` and `reject()` load
   * before saving, and quietly widening what they hydrate is how cascade
   * surprises happen.
   */
  async adminGetPartnerMarketing(partnerId: number) {
    // Throws 404 for an id that does not exist, rather than answering with two
    // empty lists as though the partner were real but idle.
    await this.getPartnerOrThrowById(partnerId);

    const [links, coupons] = await Promise.all([
      this.getMyLinks(partnerId),
      this.getMyCoupons(partnerId),
    ]);

    return { links, coupons };
  }

  /**
   * The performance figures on a partner's detail screen, last 30 days (#061).
   *
   * Two different questions, because the two programmes are two businesses. A
   * marketing partner is judged link by link — clicks, orders, commission, and
   * how many came back. A distribution partner has no links: what matters is
   * what they bought (at their price, not esim.vn's list price), how many
   * orders that was across eSIMs and top-ups together, and the same refund
   * rate.
   */
  async adminPartnerPerformance(partnerId: number): Promise<{
    partnerType: string;
    links: {
      id: number;
      code: string;
      label: string | null;
      clicks: number;
      orders: number;
      commissionVnd: number;
      refundedOrders: number;
      refundRatePercent: number;
    }[];
    coupons: {
      code: string;
      orders: number;
      commissionVnd: number;
      refundedOrders: number;
      refundRatePercent: number;
    }[];
    distribution: {
      revenueVnd: number;
      orders: number;
      refundedOrders: number;
      refundRatePercent: number;
    } | null;
  }> {
    const partner = await this.getPartnerOrThrowById(partnerId);
    const rate = (refunded: number, total: number) =>
      total > 0 ? Math.round((refunded / total) * 1000) / 10 : 0;

    if (partner.partnerType === PartnerTypeEnum.DISTRIBUTION) {
      const [row] = await this.dataSource.query(
        `SELECT
           COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (
             WHERE o.status IN ('paid', 'completed')
           ), 0) AS "revenueVnd",
           COUNT(*) FILTER (WHERE o.status IN ('paid', 'completed')) AS orders,
           COUNT(*) FILTER (WHERE o.status = 'refunded') AS "refundedOrders"
         FROM "order" o
         WHERE o."userId" = $1
           AND o."deletedAt" IS NULL
           AND o."createdAt" >= now() - INTERVAL '30 days'`,
        [partner.userId],
      );

      const orders = Number(row?.orders ?? 0);
      const refundedOrders = Number(row?.refundedOrders ?? 0);
      return {
        partnerType: partner.partnerType,
        links: [],
        coupons: [],
        distribution: {
          // What they paid us — their buying price, not esim.vn's list price.
          revenueVnd: Number(row?.revenueVnd ?? 0),
          // eSIM and top-up orders together, as the brief asks.
          orders,
          refundedOrders,
          refundRatePercent: rate(refundedOrders, orders + refundedOrders),
        },
      };
    }

    const linkRows = await this.dataSource.query(
      `SELECT l.id, l.code, l.label,
              COALESCE(cl.clicks, 0) AS clicks,
              COALESCE(o.orders, 0) AS orders,
              COALESCE(o."commissionVnd", 0) AS "commissionVnd",
              COALESCE(o."refundedOrders", 0) AS "refundedOrders"
       FROM partner_link l
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS clicks FROM partner_link_click c
         WHERE c."linkId" = l.id AND c."clickedAt" >= now() - INTERVAL '30 days'
       ) cl ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE ord.status IN ('paid', 'completed')) AS orders,
                COUNT(*) FILTER (WHERE ord.status = 'refunded') AS "refundedOrders",
                COALESCE(SUM(opc."commissionVnd") FILTER (
                  WHERE opc.status <> 'reversed'
                ), 0) AS "commissionVnd"
         FROM order_partner_commission opc
         JOIN "order" ord ON ord.id = opc."orderId" AND ord."deletedAt" IS NULL
         WHERE opc."linkId" = l.id
           AND ord."createdAt" >= now() - INTERVAL '30 days'
       ) o ON TRUE
       WHERE l."partnerId" = $1
       ORDER BY orders DESC, clicks DESC`,
      [partnerId],
    );

    const couponRows = await this.dataSource.query(
      `SELECT c.code,
              COUNT(*) FILTER (WHERE o.status IN ('paid', 'completed')) AS orders,
              COUNT(*) FILTER (WHERE o.status = 'refunded') AS "refundedOrders",
              COALESCE(SUM(opc."commissionVnd") FILTER (
                WHERE opc.status <> 'reversed'
              ), 0) AS "commissionVnd"
       FROM coupon c
       JOIN "order" o
         ON o."couponCode" = c.code
        AND o."deletedAt" IS NULL
        AND o."createdAt" >= now() - INTERVAL '30 days'
       LEFT JOIN order_partner_commission opc ON opc."orderId" = o.id
       WHERE c."partnerId" = $1
       GROUP BY c.code
       ORDER BY orders DESC`,
      [partnerId],
    );

    return {
      partnerType: partner.partnerType,
      links: (linkRows as Record<string, any>[]).map((r) => {
        const orders = Number(r.orders ?? 0);
        const refundedOrders = Number(r.refundedOrders ?? 0);
        return {
          id: Number(r.id),
          code: String(r.code),
          label: r.label ?? null,
          clicks: Number(r.clicks ?? 0),
          orders,
          commissionVnd: Number(r.commissionVnd ?? 0),
          refundedOrders,
          refundRatePercent: rate(refundedOrders, orders + refundedOrders),
        };
      }),
      coupons: (couponRows as Record<string, any>[]).map((r) => {
        const orders = Number(r.orders ?? 0);
        const refundedOrders = Number(r.refundedOrders ?? 0);
        return {
          code: String(r.code),
          orders,
          commissionVnd: Number(r.commissionVnd ?? 0),
          refundedOrders,
          refundRatePercent: rate(refundedOrders, orders + refundedOrders),
        };
      }),
      distribution: null,
    };
  }

  /**
   * Create a marketing link on a partner's behalf (#061).
   *
   * "Admin có quyền tạo link tiếp thị/mã tiếp thị giúp đối tác mà không bị giới
   * hạn gì cả" — usually for a VIP who wants a memorable code and should not
   * have to ask twice. The partner's own limits do not apply; what the admin
   * types is what they get.
   */
  async adminCreateLinkForPartner(
    partnerId: number,
    dto: CreatePartnerLinkDto,
  ) {
    const partner = await this.getPartnerOrThrowById(partnerId);
    const code = dto.code?.trim().toUpperCase() || this.generateLinkCode();

    const taken = await this.linkRepository.findOne({ where: { code } });
    if (taken) {
      throw new BadRequestException(`Mã link "${code}" đã được dùng.`);
    }

    return this.linkRepository.save(
      this.linkRepository.create({
        partnerId: partner.id,
        code,
        label: dto.label ?? null,
        targetPath: dto.targetPath ?? null,
        status: PartnerLinkStatusEnum.ACTIVE,
      }),
    );
  }

  async adminFindById(id: number): Promise<PartnerEntity> {
    const partner = await this.partnerRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!partner) throw new NotFoundException(`Partner ${id} not found`);
    return partner;
  }

  async approve(id: number, adminId: number): Promise<PartnerEntity> {
    const partner = await this.adminFindById(id);
    // A rejection is a decision, not a dead end (#056): the applicant sends the
    // missing paper, or the reviewer was wrong, and an admin may approve them
    // by hand without making them apply again.
    const approvable: PartnerStatusEnum[] = [
      PartnerStatusEnum.PENDING,
      PartnerStatusEnum.REJECTED,
    ];
    if (!approvable.includes(partner.status)) {
      throw new BadRequestException(
        'Chỉ có thể duyệt đối tác đang chờ duyệt hoặc đã bị từ chối.',
      );
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      partner.status = PartnerStatusEnum.ACTIVE;
      partner.approvedAt = new Date();
      partner.approvedByAdminId = adminId;
      // Otherwise an approved partner keeps a "bị từ chối vì..." line on their
      // record, which is what support would read back to them.
      partner.rejectionReason = null;
      const saved = await manager.getRepository(PartnerEntity).save(partner);

      await manager.getRepository(UserEntity).update(partner.userId, {
        status: { id: StatusEnum.active } as UserEntity['status'],
      });

      return saved;
    });

    // Outside the transaction: an applicant who was approved stays approved
    // even if the mail fails (#095).
    this.notifyPartnerDecision(saved, 'approved');
    return saved;
  }

  async reject(
    id: number,
    dto: RejectPartnerDto,
    adminId: number,
  ): Promise<PartnerEntity> {
    const partner = await this.adminFindById(id);
    if (partner.status !== PartnerStatusEnum.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể từ chối đối tác đang ở trạng thái chờ duyệt.',
      );
    }
    partner.status = PartnerStatusEnum.REJECTED;
    partner.rejectionReason = dto.reason;
    partner.approvedByAdminId = adminId;
    const saved = await this.partnerRepository.save(partner);

    // The applicant is told why, so they can fix the application and reapply
    // instead of guessing (#095).
    this.notifyPartnerDecision(saved, 'rejected');
    return saved;
  }

  /**
   * Change one partner's status, with everything that follows from it (#061).
   *
   * The status is not a label: "tạm khoá" freezes the money and stops the
   * partner trading, "khoá tài khoản" additionally signs them out everywhere so
   * an open tab is not a way back in. Doing only the first half is how a locked
   * partner keeps selling until their session happens to expire.
   */
  async updateStatus(
    id: number,
    dto: UpdatePartnerStatusDto,
    adminId?: number,
    reason?: string,
  ): Promise<PartnerEntity> {
    const partner = await this.adminFindById(id);
    const fromStatus = partner.status;
    if (fromStatus === dto.status) return partner;

    const locking =
      dto.status === PartnerStatusEnum.HOLD ||
      dto.status === PartnerStatusEnum.DISABLED;
    if (locking && !reason?.trim()) {
      throw new BadRequestException(
        'Cần nhập lý do khi tạm khoá hoặc khoá tài khoản đối tác.',
      );
    }

    partner.status = dto.status;
    const saved = await this.partnerRepository.save(partner);
    await this.applyStatusConsequences(saved, fromStatus);
    await this.recordStatusChange({
      partnerId: saved.id,
      fromStatus,
      toStatus: dto.status,
      reason: reason?.trim() || null,
      adminId: adminId ?? null,
    });

    return saved;
  }

  /**
   * What a status change actually does to the partner's account (#061).
   *
   * - Tạm khoá: the wallet is frozen, so nothing can be spent or withdrawn, and
   *   a marketing partner's links and codes stop attributing.
   * - Khoá tài khoản: the same, plus every session is destroyed — an open tab
   *   must not be a way back into a locked account.
   * - Mở khoá: the wallet works again and the links they had switched off with
   *   the account come back on.
   */
  private async applyStatusConsequences(
    partner: PartnerEntity,
    fromStatus: PartnerStatusEnum,
  ): Promise<void> {
    const frozen =
      partner.status === PartnerStatusEnum.HOLD ||
      partner.status === PartnerStatusEnum.DISABLED;

    await this.walletRepository.update(
      { partnerId: partner.id },
      {
        status: frozen
          ? PartnerWalletStatusEnum.LOCKED
          : PartnerWalletStatusEnum.ACTIVE,
      },
    );

    // Links and codes are the marketing partner's half of "dừng hoạt động".
    if (partner.partnerType === PartnerTypeEnum.KOL || partner.canAffiliate) {
      await this.linkRepository.update(
        { partnerId: partner.id },
        {
          status: frozen
            ? PartnerLinkStatusEnum.INACTIVE
            : PartnerLinkStatusEnum.ACTIVE,
        },
      );
    }

    if (partner.status === PartnerStatusEnum.DISABLED) {
      // Signed out everywhere, so a tab left open is not a way back in.
      await this.dataSource.query(`DELETE FROM session WHERE "userId" = $1`, [
        partner.userId,
      ]);
    }

    this.logger.log(
      `Partner ${partner.id}: ${fromStatus} -> ${partner.status}` +
        `${frozen ? ' (ví bị đóng băng)' : ' (ví hoạt động lại)'}`,
    );
  }

  /**
   * The deposit limits that apply to one partner (#061).
   *
   * The programme-wide numbers are the default; a partner may be given their
   * own, which is what a distributor turning over hundreds of millions needs.
   */
  depositLimitsFor(partner: PartnerEntity): { minVnd: number; maxVnd: number } {
    return {
      minVnd: partner.depositMinVnd ?? PARTNER_DEPOSIT_MIN_VND,
      maxVnd: partner.depositMaxVnd ?? PARTNER_DEPOSIT_MAX_VND,
    };
  }

  /**
   * Contract details and per-partner deposit limits (#061).
   *
   * Saved together because they are the same screen's "Lưu lại": an admin
   * editing a contract line and a deposit ceiling in one sitting should not
   * have to think about which of two buttons writes which.
   */
  async updatePartnerByAdmin(
    id: number,
    dto: UpdatePartnerProfileByAdminDto,
  ): Promise<PartnerEntity> {
    const partner = await this.adminFindById(id);

    if (dto.contractInfo !== undefined) {
      // Blank lines are what an admin leaves behind after clicking "+" and
      // changing their mind; they have no business reaching the file.
      partner.contractInfo = dto.contractInfo
        .filter((line) => line.label?.trim())
        .map((line) => ({
          label: line.label.trim(),
          value: (line.value ?? '').trim(),
        }));
    }
    if (dto.depositMinVnd !== undefined) {
      partner.depositMinVnd = dto.depositMinVnd;
    }
    if (dto.depositMaxVnd !== undefined) {
      partner.depositMaxVnd = dto.depositMaxVnd;
    }

    const min = partner.depositMinVnd;
    const max = partner.depositMaxVnd;
    if (min != null && max != null && min > max) {
      throw new BadRequestException(
        'Mức nạp tối thiểu không được lớn hơn mức nạp tối đa.',
      );
    }

    return this.partnerRepository.save(partner);
  }

  /**
   * Create a partner account by hand (#059).
   *
   * Some partners are signed over the phone and cannot be asked to fill in a
   * form and wait for a review. The admin supplies everything the form asks
   * for except the password — they must not choose somebody else's — so the
   * system mints one, emails it, and marks the account so that password is
   * replaced at the first sign-in.
   *
   * The partner is active immediately: an admin adding them by hand has already
   * made the decision the queue exists to make.
   */
  async adminCreatePartner(
    dto: AdminCreatePartnerDto,
    adminId: number,
  ): Promise<{ partnerId: number; userId: number }> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.contactEmail },
    });
    if (existing) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { contactEmail: 'emailAlreadyExists' },
      });
    }

    // Long enough to be worth nothing to a guesser, short enough to retype
    // from an email without a mistake.
    const temporaryPassword = randomBytes(6).toString('base64url');

    const created = await this.dataSource.transaction(async (manager) => {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash(temporaryPassword, salt);

      const userRepo = manager.getRepository(UserEntity);
      const user = await userRepo.save(
        userRepo.create({
          email: dto.contactEmail,
          password,
          provider: 'email',
          firstName: dto.contactName,
          lastName: null,
          phoneNumber: dto.contactPhone,
          role: { id: RoleEnum.partner } as UserEntity['role'],
          // Active straight away: there is nothing left to approve.
          status: { id: StatusEnum.active } as UserEntity['status'],
          mustChangePassword: true,
        }),
      );

      const partnerRepo = manager.getRepository(PartnerEntity);
      const partner = await partnerRepo.save(
        partnerRepo.create({
          userId: user.id,
          partnerType: dto.partnerType,
          legalType: dto.legalType,
          companyName: dto.companyName ?? null,
          taxCode: dto.taxCode ?? null,
          businessAddress: dto.businessAddress ?? null,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          channelInfo: dto.channelInfo ?? null,
          status: PartnerStatusEnum.ACTIVE,
          notes: dto.notes ?? null,
          approvedAt: new Date(),
          approvedByAdminId: adminId,
        }),
      );

      const walletRepo = manager.getRepository(PartnerWalletEntity);
      await walletRepo.save(
        walletRepo.create({
          partnerId: partner.id,
          balanceVnd: 0,
          status: PartnerWalletStatusEnum.ACTIVE,
        }),
      );

      return { partnerId: partner.id, userId: user.id };
    });

    await this.recordStatusChange({
      partnerId: created.partnerId,
      fromStatus: null,
      toStatus: PartnerStatusEnum.ACTIVE,
      reason: 'Admin tạo tài khoản đối tác thủ công',
      adminId,
    });

    // Outside the transaction: the account exists either way, and a failed
    // email is something support can resend rather than a reason to lose it.
    void this.mailService
      .sendPartnerAccountCreated({
        to: dto.contactEmail,
        contactName: dto.contactName,
        email: dto.contactEmail,
        temporaryPassword,
      })
      .catch((error) => {
        this.logger.error(
          `Partner ${created.partnerId} was created but the credentials email failed: ${error}`,
        );
      });

    return created;
  }

  /**
   * Change several partners' status in one go (#059).
   *
   * The reason is required for a hold or a lock: those are the decisions
   * somebody has to answer for a month later, and the old flow changed the
   * status with nothing recorded but the new value (#060).
   */
  async bulkUpdateStatus(
    dto: BulkPartnerStatusDto,
    adminId: number,
  ): Promise<{ updated: number; skipped: number[] }> {
    const locking =
      dto.status === PartnerStatusEnum.HOLD ||
      dto.status === PartnerStatusEnum.DISABLED;
    if (locking && !dto.reason?.trim()) {
      throw new BadRequestException(
        'Cần nhập lý do khi tạm khoá hoặc khoá tài khoản đối tác.',
      );
    }

    const ids: number[] = [...new Set(dto.ids)];
    const partners = await this.partnerRepository.find({
      where: { id: In(ids) },
    });
    const found = new Set(partners.map((p) => p.id));

    let updated = 0;
    for (const partner of partners) {
      if (partner.status === dto.status) continue;
      const fromStatus = partner.status;
      partner.status = dto.status;
      await this.partnerRepository.save(partner);
      await this.recordStatusChange({
        partnerId: partner.id,
        fromStatus,
        toStatus: dto.status,
        reason: dto.reason?.trim() || null,
        adminId,
      });
      updated += 1;
    }

    return { updated, skipped: ids.filter((id) => !found.has(id)) };
  }

  /** Append to a partner's status history (#059, #060). */
  private async recordStatusChange(entry: {
    partnerId: number;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    adminId: number | null;
  }): Promise<void> {
    await this.statusChangeRepository.save(
      this.statusChangeRepository.create({
        partnerId: entry.partnerId,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        reason: entry.reason,
        changedByAdminId: entry.adminId,
      }),
    );
  }

  /** A partner's status history, newest first (#060). */
  async getStatusHistory(partnerId: number, limit = 50) {
    return this.statusChangeRepository.find({
      where: { partnerId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * Record an admin's own note on a partner (#056).
   *
   * Kept apart from the applicant's own `notes`: this is the reviewer's memory
   * of the decision — who they called, what they checked, what to look at next
   * time — and it survives approval and rejection alike.
   */
  async setAdminNote(id: number, adminNote: string): Promise<PartnerEntity> {
    const partner = await this.adminFindById(id);
    partner.adminNote = adminNote.trim() || null;
    return this.partnerRepository.save(partner);
  }

  /**
   * Let a distribution partner run the affiliate programme too, or stop them
   * (#048).
   *
   * Revoking hides the screens and refuses new links or codes, but leaves what
   * they already created alone: a code printed on somebody's video is still a
   * code customers are typing, and the commission already earned is theirs.
   */
  async setAffiliateGrant(
    id: number,
    canAffiliate: boolean,
  ): Promise<PartnerEntity> {
    const partner = await this.adminFindById(id);
    partner.canAffiliate = canAffiliate;
    return this.partnerRepository.save(partner);
  }

  /**
   * Let this partner name their own link codes, or stop them (#014).
   *
   * Revoking does not touch codes already created: the campaign they printed on
   * a video is still the campaign customers are typing.
   */
  async setLinkCodePermission(
    id: number,
    canCustomLinkCode: boolean,
  ): Promise<PartnerEntity> {
    const partner = await this.adminFindById(id);
    partner.canCustomLinkCode = canCustomLinkCode;
    return this.partnerRepository.save(partner);
  }

  async assignTier(
    id: number,
    dto: AssignPartnerTierDto,
  ): Promise<PartnerEntity> {
    const partner = await this.adminFindById(id);
    const tier = await this.tierRepository.findOne({
      where: { partnerType: partner.partnerType, tierCode: dto.tierCode },
    });
    if (!tier) {
      throw new NotFoundException(
        `Không tìm thấy tier ${dto.tierCode} cho loại đối tác ${partner.partnerType}.`,
      );
    }
    // A tier change applies from now on, never backwards (#042): the date is
    // what an admin shows a partner asking which orders earned at which rate.
    const tierBefore = partner.tierCode ?? null;
    partner.tierCode = dto.tierCode;
    if (tierBefore !== dto.tierCode) {
      partner.tierEffectiveFrom = new Date();
    }
    const saved = await this.partnerRepository.save(partner);

    if (tierBefore !== dto.tierCode) {
      // The weekly review leaves a trail; a change made by hand used to leave
      // none at all.
      await this.tierEvaluationRepository.save(
        this.tierEvaluationRepository.create({
          partnerId: partner.id,
          revenueVnd: 0,
          validOrders: 0,
          tierBefore,
          tierAfter: dto.tierCode,
          result: 'manual',
        }),
      );
    }

    return saved;
  }

  // ───────────────────────── Admin: wallet / deposits ─────────────────────────

  async adjustWallet(
    partnerId: number,
    dto: AdjustPartnerWalletDto,
    adminId: number,
  ): Promise<PartnerWalletTransactionEntity> {
    const amount = Math.round(Number(dto.amountVnd));
    if (amount === 0) {
      throw new BadRequestException('amountVnd must be different from 0');
    }
    return this.createWalletTransaction(
      partnerId,
      amount > 0
        ? PartnerWalletTransactionTypeEnum.MANUAL_CREDIT
        : PartnerWalletTransactionTypeEnum.MANUAL_DEBIT,
      amount,
      {
        sourceType: 'admin',
        sourceId: String(adminId),
        reason: dto.reason,
        createdByAdminId: adminId,
      },
    );
  }

  async adminListDepositRequests(status?: PartnerDepositRequestStatusEnum) {
    return this.depositRequestRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /**
   * Looked up by PaymentService's SePay webhook handler when an incoming
   * transfer's code doesn't match any Order — see AddPartnerAttributionToOrder
   * webhook branch in payment.service.ts.
   */
  async findDepositRequestByBankTransferCode(
    code: string,
  ): Promise<PartnerDepositRequestEntity | null> {
    return this.depositRequestRepository.findOne({
      where: { bankTransferCode: code },
    });
  }

  async confirmDepositRequest(
    id: number,
    adminId: number,
  ): Promise<PartnerDepositRequestEntity> {
    const request = await this.getDepositRequestOrThrow(id);
    if (request.status !== PartnerDepositRequestStatusEnum.PENDING) {
      throw new BadRequestException('Yêu cầu nạp tiền này đã được xử lý.');
    }
    return this.creditDepositRequest(request, {
      adminId,
      reason: 'Xác nhận nạp ký quỹ qua chuyển khoản',
    });
  }

  /**
   * SePay webhook variant of {@link confirmDepositRequest} — no adminId (the
   * transfer was matched automatically), and idempotent: a request that's
   * already CONFIRMED/CANCELLED is returned as-is instead of throwing, since
   * SePay may redeliver the same webhook event.
   */
  async confirmDepositRequestBySePay(
    id: number,
    paymentId: string | null,
  ): Promise<PartnerDepositRequestEntity> {
    const request = await this.getDepositRequestOrThrow(id);
    if (request.status !== PartnerDepositRequestStatusEnum.PENDING) {
      return request;
    }
    return this.creditDepositRequest(request, {
      adminId: null,
      reason: 'Xác nhận nạp ký quỹ qua chuyển khoản (SePay tự động)',
      metadata: paymentId ? { sepayPaymentId: paymentId } : undefined,
    });
  }

  private async getDepositRequestOrThrow(
    id: number,
  ): Promise<PartnerDepositRequestEntity> {
    const request = await this.depositRequestRepository.findOne({
      where: { id },
    });
    if (!request)
      throw new NotFoundException(`Deposit request ${id} not found`);
    return request;
  }

  private async creditDepositRequest(
    request: PartnerDepositRequestEntity,
    opts: {
      adminId: number | null;
      reason: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<PartnerDepositRequestEntity> {
    // What reaches the wallet, not what was sent: a card top-up has the
    // gateway's fee taken out of it (#047). Rows written before the fee existed
    // have no `creditedVnd`, and for those the two are the same number.
    const creditVnd = Number(request.creditedVnd ?? request.amountVnd);

    const transaction = await this.createWalletTransaction(
      request.partnerId,
      PartnerWalletTransactionTypeEnum.DEPOSIT,
      creditVnd,
      {
        sourceType: 'partner_deposit_request',
        sourceId: String(request.id),
        idempotencyKey: `partner_deposit:${request.id}`,
        reason: opts.reason,
        metadata: opts.metadata ?? null,
        createdByAdminId: opts.adminId,
      },
    );

    request.status = PartnerDepositRequestStatusEnum.CONFIRMED;
    request.confirmedByAdminId = opts.adminId;
    request.confirmedAt = new Date();
    request.walletTransactionId = transaction.id;
    return this.depositRequestRepository.save(request);
  }

  // ───────────────────────── Admin: commissions / payouts ─────────────────────────

  async adminListCommissions(query: QueryPartnerCommissionDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const [data, count] = await this.commissionRepository.findAndCount({
      where: {
        ...(query.partnerId && { partnerId: query.partnerId }),
        ...(query.status && {
          status: query.status as OrderPartnerCommissionStatusEnum,
        }),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, totalCount: count };
  }

  async adminListPayouts(status?: PartnerPayoutStatusEnum) {
    return this.payoutRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async approvePayout(
    id: number,
    adminId: number,
  ): Promise<PartnerPayoutEntity> {
    const payout = await this.getPayoutOrThrow(id);
    if (payout.status !== PartnerPayoutStatusEnum.PENDING) {
      throw new BadRequestException('Yêu cầu rút tiền này đã được xử lý.');
    }
    payout.status = PartnerPayoutStatusEnum.APPROVED;
    payout.processedByAdminId = adminId;
    payout.processedAt = new Date();
    return this.payoutRepository.save(payout);
  }

  async rejectPayout(
    id: number,
    adminNote: string | undefined,
    adminId: number,
  ): Promise<PartnerPayoutEntity> {
    const payout = await this.getPayoutOrThrow(id);
    if (payout.status !== PartnerPayoutStatusEnum.PENDING) {
      throw new BadRequestException('Yêu cầu rút tiền này đã được xử lý.');
    }
    payout.status = PartnerPayoutStatusEnum.REJECTED;
    payout.adminNote = adminNote ?? null;
    payout.processedByAdminId = adminId;
    payout.processedAt = new Date();
    return this.payoutRepository.save(payout);
  }

  async markPayoutPaid(
    id: number,
    adminNote: string | undefined,
    adminId: number,
  ): Promise<PartnerPayoutEntity> {
    const payout = await this.getPayoutOrThrow(id);
    if (payout.status !== PartnerPayoutStatusEnum.APPROVED) {
      throw new BadRequestException(
        'Chỉ có thể đánh dấu đã thanh toán cho yêu cầu đã được duyệt.',
      );
    }

    const transaction = await this.createWalletTransaction(
      payout.partnerId,
      PartnerWalletTransactionTypeEnum.PAYOUT,
      -Math.abs(payout.amountVnd),
      {
        sourceType: 'partner_payout',
        sourceId: String(payout.id),
        idempotencyKey: `partner_payout:${payout.id}`,
        reason: 'Thanh toán hoa hồng/rút ký quỹ cho đối tác',
        createdByAdminId: adminId,
      },
    );

    payout.status = PartnerPayoutStatusEnum.PAID;
    payout.adminNote = adminNote ?? payout.adminNote;
    payout.walletTransactionId = transaction.id;
    return this.payoutRepository.save(payout);
  }

  private async getPayoutOrThrow(id: number): Promise<PartnerPayoutEntity> {
    const payout = await this.payoutRepository.findOne({ where: { id } });
    if (!payout) throw new NotFoundException(`Payout ${id} not found`);
    return payout;
  }

  // ───────────────────────── Admin: tiers ─────────────────────────

  async createTier(dto: CreatePartnerTierDto): Promise<PartnerTierEntity> {
    return this.tierRepository.save(
      this.tierRepository.create({
        partnerType: dto.partnerType,
        tierCode: dto.tierCode,
        tierName: dto.tierName,
        minVolumeVnd: dto.minVolumeVnd ?? 0,
        commissionPercent: dto.commissionPercent ?? 0,
        maxDiscountPercent: dto.maxDiscountPercent ?? 0,
        // Each tier carries its own attribution window (#037).
        attributionDays: dto.attributionDays ?? PARTNER_LINK_ATTRIBUTION_DAYS,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async findAllTiers(
    partnerType?: PartnerTypeEnum,
  ): Promise<PartnerTierEntity[]> {
    return this.tierRepository.find({
      where: { isActive: true, ...(partnerType && { partnerType }) },
      order: { sortOrder: 'ASC' },
    });
  }

  async updateTier(
    id: number,
    dto: UpdatePartnerTierDto,
  ): Promise<PartnerTierEntity> {
    const tier = await this.tierRepository.findOne({ where: { id } });
    if (!tier) throw new NotFoundException(`Tier ${id} not found`);
    Object.assign(tier, {
      ...(dto.tierName !== undefined && { tierName: dto.tierName }),
      ...(dto.minVolumeVnd !== undefined && { minVolumeVnd: dto.minVolumeVnd }),
      ...(dto.commissionPercent !== undefined && {
        commissionPercent: dto.commissionPercent,
      }),
      ...(dto.attributionDays !== undefined && {
        attributionDays: dto.attributionDays,
      }),
      ...(dto.maxDiscountPercent !== undefined && {
        maxDiscountPercent: dto.maxDiscountPercent,
      }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return this.tierRepository.save(tier);
  }

  async removeTier(id: number): Promise<void> {
    await this.tierRepository.softDelete(id);
  }

  // ───────────────────────── Public link click tracking ─────────────────────────

  async recordClick(
    code: string,
    meta: {
      ipHash?: string | null;
      userAgent?: string | null;
      referrer?: string | null;
      visitorId?: string | null;
    },
  ): Promise<{ targetPath: string | null; clickId: string } | null> {
    const link = await this.linkRepository.findOne({
      where: { code, status: PartnerLinkStatusEnum.ACTIVE },
    });
    if (!link) return null;

    // Minted here, on the server, and handed back so the redirect can carry it
    // in the URL (#039). 32 hex characters: guessing one would mean guessing a
    // click that really happened.
    const clickId = randomBytes(16).toString('hex');

    await this.linkClickRepository.save(
      this.linkClickRepository.create({
        linkId: link.id,
        ipHash: meta.ipHash ?? null,
        userAgent: meta.userAgent ?? null,
        referrer: meta.referrer ?? null,
        visitorId: meta.visitorId ?? null,
        clickId,
        deviceHash: partnerDeviceFingerprint(meta.ipHash, meta.userAgent),
      }),
    );
    await this.linkRepository.increment({ id: link.id }, 'clickCount', 1);

    return { targetPath: link.targetPath ?? null, clickId };
  }

  // ───────────────────────── Partner portal read models ─────────────────────────

  /**
   * Orders attributed to this partner, newest first — the "Đơn hàng" screen.
   *
   * Read-only across modules, so it goes through `dataSource` rather than
   * pulling the orders repositories into this module.
   */
  async getMyOrders(
    partnerId: number,
    limit = 50,
  ): Promise<PartnerOrderRowDto[]> {
    const rows = await this.dataSource.query(
      `SELECT o."orderNumber",
              o.status,
              ${ORDER_REVENUE_SQL} AS "vndPrice",
              COALESCE(o."refundedAmountVnd", 0) AS "refundedAmountVnd",
              o."createdAt",
              c."commissionVnd",
              c.status AS "commissionStatus",
              l.code   AS "linkCode",
              -- Rate this order actually paid, read back from the money so a
              -- later tier change does not rewrite it (#026).
              CASE
                WHEN c."commissionVnd" IS NOT NULL AND ${ORDER_REVENUE_SQL} > 0
                THEN ROUND(c."commissionVnd" * 100.0 / (${ORDER_REVENUE_SQL}), 1)
              END AS "commissionPercent",
              -- Which of the partner's discount codes brought the order, when
              -- it came in through a code rather than a link (#024).
              o."couponCode" AS "couponCode",
              COALESCE(
                json_agg(
                  json_build_object(
                    'planName', p.name,
                    'quantity', oi.quantity,
                    -- Per-line price and whether this particular product came
                    -- back (#023): an order can be half refunded, and the
                    -- partner needs to see which half.
                    'vndPrice', oi."vndPrice",
                    'refunded', oi.status = 'refunded'
                  ) ORDER BY oi.id
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'
              ) AS items,
              (
                SELECT count(*)::int FROM esim e
                JOIN order_item oi2 ON oi2.id = e."orderItemId"
                WHERE oi2."orderId" = o.id
              ) AS "esimCount",
              -- The partner buying through their own link (#095).
              (o."userId" IS NOT NULL AND o."userId" = pa."userId") AS "isSelfReferral",
              -- First paid order this account ever placed on esim.vn, or a
              -- returning buyer (#021) — same rule as the dashboard tile so the
              -- two screens cannot disagree.
              NOT EXISTS (
                SELECT 1 FROM "order" prev
                WHERE prev."userId" = o."userId"
                  AND prev.id <> o.id
                  AND prev."deletedAt" IS NULL
                  AND prev.status IN ('paid', 'completed')
                  AND prev."createdAt" < o."createdAt"
              ) AS "isNewCustomer"
       FROM "order" o
       JOIN partner pa ON pa.id = o."attributedPartnerId"
       LEFT JOIN order_item oi ON oi."orderId" = o.id
       LEFT JOIN plan p ON p.id = oi."planId"
       LEFT JOIN order_partner_commission c ON c."orderId" = o.id
       LEFT JOIN partner_link l ON l.id = c."linkId"
       WHERE o."attributedPartnerId" = $1 AND o."deletedAt" IS NULL
         -- Top-ups are the customer's business with their own eSIM, not the
         -- partner's referral (#025).
         AND o."orderType" <> '${TOPUP_ORDER_TYPE}'
       GROUP BY o.id, c."commissionVnd", c.status, l.code, pa."userId"
       ORDER BY o."createdAt" DESC
       LIMIT $2`,
      [partnerId, limit],
    );

    return rows.map((r: Record<string, any>) => {
      const commissionVnd =
        r.commissionVnd == null ? null : Number(r.commissionVnd);
      const commissionStatus = r.commissionStatus ?? null;
      const { validity, invalidReason } = classifyPartnerOrder(
        r.status,
        commissionStatus,
        Boolean(r.isSelfReferral),
      );

      // Revenue net of what the customer got back (#018): a partly refunded
      // order is not worth what it was rung up at, and the commission beside
      // it has already been adjusted the same way.
      const refundedVnd = Number(r.refundedAmountVnd ?? 0);
      const grossVnd = Number(r.vndPrice ?? 0);

      return {
        orderNumber: r.orderNumber,
        status: r.status,
        vndPrice: Math.max(0, grossVnd - refundedVnd),
        grossVndPrice: grossVnd,
        refundedVnd,
        createdAt: r.createdAt,
        commissionVnd,
        commissionPercent:
          r.commissionPercent == null ? null : Number(r.commissionPercent),
        commissionStatus,
        linkCode: r.linkCode ?? null,
        couponCode: r.couponCode ?? null,
        customerType: r.isNewCustomer ? 'new' : 'returning',
        esimCount: Number(r.esimCount ?? 0),
        items: r.items ?? [],
        validity,
        invalidReason,
      };
    });
  }

  /**
   * The partner's attributed orders as a spreadsheet (#027).
   *
   * Built from the same read model as the screen, so the file cannot disagree
   * with the list: revenue net of refunds, commission net of reversals, and no
   * top-ups (#025).
   */
  async exportMyOrdersToExcel(partnerId: number): Promise<Buffer> {
    const orders = await this.getMyOrders(partnerId, 5000);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'esim.vn';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Đơn hàng');
    sheet.columns = [
      { header: 'Mã đơn hàng', key: 'orderNumber', width: 28 },
      { header: 'Tên sản phẩm', key: 'products', width: 40 },
      { header: 'Giá trị doanh thu (VND)', key: 'revenue', width: 22 },
      { header: 'Nguồn ghi nhận', key: 'source', width: 24 },
      { header: 'Khách hàng', key: 'customer', width: 16 },
      { header: 'Số lượng eSIM', key: 'esimCount', width: 14 },
      { header: 'Mức % hoa hồng', key: 'commissionPercent', width: 16 },
      { header: 'Tiền hoa hồng (VND)', key: 'commission', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'Ngày đặt hàng', key: 'createdAt', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };

    const statusLabels: Record<string, string> = {
      pending: 'Chờ xác nhận',
      credited: 'Đã duyệt',
      reversed: 'Đơn hoàn tiền',
    };

    for (const order of orders) {
      sheet.addRow({
        orderNumber: order.orderNumber,
        products: order.items
          .map((item) =>
            item.refunded
              ? `${item.planName} (đã hoàn)`
              : `${item.planName}${item.quantity > 1 ? ` x${item.quantity}` : ''}`,
          )
          .join(' + '),
        revenue: Number(order.vndPrice ?? 0),
        source: order.linkCode
          ? `Link: /go/${order.linkCode}`
          : order.couponCode
            ? `Mã: ${order.couponCode}`
            : '—',
        customer: order.customerType === 'new' ? 'Khách mới' : 'Khách quay lại',
        esimCount: Number(order.esimCount ?? 0),
        commissionPercent:
          order.commissionPercent == null
            ? ''
            : Number(order.commissionPercent),
        commission: Number(order.commissionVnd ?? 0),
        status:
          statusLabels[order.commissionStatus ?? ''] ??
          'Không phát sinh hoa hồng',
        createdAt: new Date(order.createdAt),
      });
    }

    sheet.getColumn('revenue').numFmt = '#,##0';
    sheet.getColumn('commission').numFmt = '#,##0';
    sheet.getColumn('createdAt').numFmt = 'dd/mm/yyyy hh:mm';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * One attributed order in full, with how it came to be attributed (#026).
   *
   * The timeline answers the question a partner actually asks when a commission
   * looks wrong: when did this customer touch my link, when did they buy, when
   * did the eSIM start, and when was the money approved or taken back.
   */
  async getMyOrderDetail(partnerId: number, orderNumber: string) {
    const [row] = await this.dataSource.query(
      `SELECT o.id,
              o."orderNumber",
              o.status,
              o."createdAt",
              o."refundedAmountVnd",
              ${ORDER_REVENUE_SQL} AS "revenueVnd",
              c."commissionVnd",
              c."reversedCommissionVnd",
              c.status AS "commissionStatus",
              c."linkId",
              l.code AS "linkCode",
              o."couponCode",
              credit."createdAt" AS "creditedAt",
              reversal."createdAt" AS "reversedAt",
              (
                SELECT MIN(e."activatedAt") FROM esim e
                JOIN order_item oi ON oi.id = e."orderItemId"
                WHERE oi."orderId" = o.id
              ) AS "activatedAt",
              (
                SELECT bool_or(p.provider = 'viettel' OR p."isLocalInventory")
                FROM order_item oi
                JOIN plan p ON p.id = oi."planId"
                WHERE oi."orderId" = o.id
              ) AS "activatesOnPurchase",
              (
                SELECT MAX(k."clickedAt") FROM partner_link_click k
                WHERE k."linkId" = c."linkId" AND k."clickedAt" <= o."createdAt"
              ) AS "clickedAt",
              COALESCE(
                json_agg(
                  json_build_object(
                    'planName', p2.name,
                    'quantity', oi2.quantity,
                    'vndPrice', oi2."vndPrice",
                    'refunded', oi2.status = 'refunded'
                  ) ORDER BY oi2.id
                ) FILTER (WHERE oi2.id IS NOT NULL),
                '[]'
              ) AS items
       FROM "order" o
       LEFT JOIN order_partner_commission c ON c."orderId" = o.id
       LEFT JOIN partner_link l ON l.id = c."linkId"
       LEFT JOIN partner_wallet_transaction credit ON credit.id = c."rewardTransactionId"
       LEFT JOIN partner_wallet_transaction reversal ON reversal.id = c."reversedTransactionId"
       LEFT JOIN order_item oi2 ON oi2."orderId" = o.id
       LEFT JOIN plan p2 ON p2.id = oi2."planId"
       WHERE o."attributedPartnerId" = $1
         AND o."orderNumber" = $2
         AND o."deletedAt" IS NULL
       GROUP BY o.id, c."commissionVnd", c."reversedCommissionVnd", c.status,
                c."linkId", l.code, credit."createdAt", reversal."createdAt"`,
      [partnerId, orderNumber],
    );

    if (!row) throw new NotFoundException('Không tìm thấy đơn hàng.');

    const revenueVnd = Number(row.revenueVnd ?? 0);
    const commissionVnd =
      row.commissionVnd == null ? null : Number(row.commissionVnd);

    return {
      orderNumber: row.orderNumber,
      status: row.status,
      createdAt: row.createdAt,
      items: row.items ?? [],
      revenueVnd,
      refundedVnd: Number(row.refundedAmountVnd ?? 0),
      commissionVnd,
      // Read back from the money rather than the tier, so a rate that changed
      // after the order still shows what this order actually paid.
      commissionPercent:
        commissionVnd && revenueVnd > 0
          ? Math.round((commissionVnd / revenueVnd) * 1000) / 10
          : null,
      commissionStatus: row.commissionStatus ?? null,
      source: row.linkCode
        ? { type: 'link' as const, code: row.linkCode }
        : { type: 'coupon' as const, code: row.couponCode ?? null },
      timeline: {
        /** Last click on the link before the order — the visit we attribute to. */
        clickedAt: row.clickedAt ?? null,
        placedAt: row.createdAt,
        /**
         * Viettel and domestic-inventory eSIMs are usable the moment the order
         * goes through, so they count as activated then (#026).
         */
        activatedAt:
          row.activatedAt ?? (row.activatesOnPurchase ? row.createdAt : null),
        creditedAt: row.creditedAt ?? null,
        reversedAt: row.reversedAt ?? null,
      },
    };
  }

  /**
   * A discount the partner funds out of their own commission (#028).
   *
   * The cap is the whole idea: a partner decides how to split the commission
   * they already earn — keep it, or hand part of it to the customer as a
   * discount. The two shares always add up to the original commission, so a
   * code may not give away more than the partner's own rate.
   *
   * Partner codes are never advertised on the cart page: the customer types in
   * the one their KOL gave them, while the house's own codes keep showing.
   */
  async createMyCoupon(partnerId: number, dto: CreatePartnerCouponDto) {
    const partner = await this.getPartnerOrThrowById(partnerId);
    this.assertMayAffiliate(partner, 'mã giảm giá');

    const tier = partner.tierCode
      ? await this.tierRepository.findOne({
          where: {
            partnerType: partner.partnerType,
            tierCode: partner.tierCode,
          },
        })
      : null;
    const commissionPercent = Number(tier?.commissionPercent ?? 0);

    if (commissionPercent <= 0) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          discountPercent:
            'Tài khoản của bạn chưa được gán hạng nên chưa có hoa hồng để chia cho khách.',
        },
      });
    }

    if (dto.discountPercent > commissionPercent) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          discountPercent: `Mức giảm tối đa bằng đúng tỷ lệ hoa hồng của bạn (${commissionPercent}%). Phần giữ lại cộng phần nhường khách luôn bằng hoa hồng gốc.`,
        },
      });
    }

    const code = dto.code.trim().toUpperCase();
    const taken = await this.couponRepository.findOne({
      where: { code },
      withDeleted: true,
    });
    if (taken) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { code: 'Mã giảm giá này đã có người dùng.' },
      });
    }

    const coupon = await this.couponRepository.save(
      this.couponRepository.create({
        code,
        discountPercent: dto.discountPercent,
        discountType: 'percent',
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        minOrderAmount: dto.minOrderAmount ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxUsage: dto.maxUsage ?? null,
        maxUsagePerUser: dto.maxUsagePerUser ?? null,
        partnerId,
        isActive: true,
        // Never listed on the cart page — the customer types the one their
        // partner gave them.
        isPublic: false,
      } as Partial<CouponEntity>),
    );

    return {
      id: coupon.id,
      code: coupon.code,
      discountPercent: Number(coupon.discountPercent),
      commissionPercent,
      /** What is left for the partner once the customer's share is given. */
      keptPercent:
        Math.round((commissionPercent - dto.discountPercent) * 100) / 100,
    };
  }

  /** Turn one of the partner's own codes on or off (#028). */
  async setMyCouponActive(
    partnerId: number,
    couponId: number,
    isActive: boolean,
  ) {
    const coupon = await this.couponRepository.findOne({
      where: { id: couponId, partnerId },
    });
    if (!coupon) throw new NotFoundException('Không tìm thấy mã giảm giá.');

    coupon.isActive = isActive;
    await this.couponRepository.save(coupon);
    return { id: coupon.id, isActive: coupon.isActive };
  }

  /**
   * Discount codes owned by this partner, with how many of their attributed
   * orders actually used each code. The buyer-facing behaviour of the code is
   * unchanged; ownership only drives this reporting.
   */
  async getMyCoupons(partnerId: number) {
    const rows = await this.dataSource.query(
      `SELECT c.id,
              c.code,
              c."discountPercent",
              c."usageCount",
              c."maxUsage",
              c."expiresAt",
              c."isActive",
              (
                SELECT COUNT(*)::int FROM "order" o
                WHERE o."attributedPartnerId" = $1
                  AND UPPER(o."couponCode") = UPPER(c.code)
                  AND o."deletedAt" IS NULL
                  AND o.status IN ('paid', 'completed')
              ) AS "myOrders",
              (
                SELECT COALESCE(SUM(o."couponDiscountVndAmount"), 0) FROM "order" o
                WHERE o."attributedPartnerId" = $1
                  AND UPPER(o."couponCode") = UPPER(c.code)
                  AND o."deletedAt" IS NULL
                  AND o.status IN ('paid', 'completed')
              ) AS "discountGivenVnd"
       FROM coupon c
       WHERE c."partnerId" = $1 AND c."deletedAt" IS NULL
       ORDER BY c."createdAt" DESC`,
      [partnerId],
    );

    return rows.map((r: Record<string, any>) => ({
      id: Number(r.id),
      code: r.code,
      discountPercent: Number(r.discountPercent ?? 0),
      usageCount: Number(r.usageCount ?? 0),
      maxUsage: r.maxUsage == null ? null : Number(r.maxUsage),
      expiresAt: r.expiresAt ?? null,
      isActive: !!r.isActive,
      myOrders: Number(r.myOrders ?? 0),
      discountGivenVnd: Number(r.discountGivenVnd ?? 0),
    }));
  }

  /** A partner's own tier review history, newest first. */
  async getMyTierEvaluations(partnerId: number, limit = 20) {
    return this.tierEvaluationRepository.find({
      where: { partnerId },
      order: { evaluatedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Weekly tier review (Sunday 03:00). For each active partner it compares
   * cumulative valid revenue — paid/completed orders attributed to them — with
   * the tier thresholds and writes one history row either way, so the partner
   * can see the review happened even when nothing changed.
   *
   * Promotion only: a partner is never automatically demoted, because dropping
   * someone's commission rate off the back of a quiet week is a commercial
   * decision, not a cron's. Demotions stay a manual admin action.
   */
  /**
   * Credit commissions whose 24h hold has passed (#019).
   *
   * Hourly rather than by the minute: the brief's promise is "sau 24h", and an
   * hour of slack on a payout that is reconciled monthly costs nobody anything.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async creditMaturedCommissions(): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT c."orderId"
       FROM order_partner_commission c
       JOIN "order" o ON o.id = c."orderId"
       WHERE c.status = $1
         AND o."deletedAt" IS NULL
         AND o.status IN ('paid', 'completed')
         AND o."createdAt" <= now() - INTERVAL '${COMMISSION_HOLD_HOURS} hours'
       LIMIT 500`,
      [OrderPartnerCommissionStatusEnum.PENDING],
    );

    let credited = 0;
    for (const row of rows as { orderId: number }[]) {
      try {
        await this.creditCommissionForOrder(row.orderId);
        credited += 1;
      } catch (error) {
        // One bad order must not stop the rest of the sweep.
        this.logger.error(
          `creditMaturedCommissions: order ${row.orderId} failed: ${(error as Error).message}`,
        );
      }
    }

    if (credited > 0) {
      this.logger.log(`Đã duyệt hoa hồng cho ${credited} đơn qua mốc 24h.`);
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async runWeeklyTierReview(): Promise<void> {
    const partners = await this.partnerRepository.find({
      where: { status: PartnerStatusEnum.ACTIVE },
    });
    if (partners.length === 0) return;

    let promoted = 0;
    for (const partner of partners) {
      try {
        const [row] = await this.dataSource.query(
          `SELECT COALESCE(SUM(${ORDER_REVENUE_SQL}), 0) AS "revenueVnd",
                  COUNT(*)::int AS "validOrders"
           FROM "order" o
           WHERE o."attributedPartnerId" = $1
             AND o."deletedAt" IS NULL
             AND o.status IN ('paid', 'completed')`,
          [partner.id],
        );
        const revenueVnd = Number(row?.revenueVnd ?? 0);
        const validOrders = Number(row?.validOrders ?? 0);

        const tiers = await this.tierRepository.find({
          where: { partnerType: partner.partnerType, isActive: true },
          order: { minVolumeVnd: 'ASC' },
        });
        // Highest tier whose threshold the partner has already cleared.
        const earned = [...tiers]
          .reverse()
          .find((t) => revenueVnd >= Number(t.minVolumeVnd));

        const currentTier = tiers.find((t) => t.tierCode === partner.tierCode);
        const shouldPromote =
          !!earned &&
          earned.tierCode !== partner.tierCode &&
          Number(earned.minVolumeVnd) > Number(currentTier?.minVolumeVnd ?? -1);

        if (shouldPromote) {
          partner.tierCode = earned.tierCode;
          // From this moment on, not backwards (#042).
          partner.tierEffectiveFrom = new Date();
          await this.partnerRepository.save(partner);
          promoted++;
        }

        await this.tierEvaluationRepository.save(
          this.tierEvaluationRepository.create({
            partnerId: partner.id,
            revenueVnd,
            validOrders,
            tierBefore: currentTier?.tierCode ?? null,
            tierAfter: shouldPromote
              ? earned!.tierCode
              : (partner.tierCode ?? null),
            result: shouldPromote ? 'promoted' : 'unchanged',
          }),
        );
      } catch (err) {
        this.logger.error(
          `Weekly tier review failed for partner ${partner.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Weekly tier review: ${partners.length} partner(s) reviewed, ${promoted} promoted`,
    );
  }

  /** Tiers a partner can be placed in, for the "Hạng đối tác" comparison. */
  async getMyTiers(partnerId: number): Promise<PartnerTierEntity[]> {
    const partner = await this.getPartnerOrThrowById(partnerId);
    return this.tierRepository.find({
      where: { partnerType: partner.partnerType, isActive: true },
      order: { sortOrder: 'ASC', minVolumeVnd: 'ASC' },
    });
  }

  /**
   * Everything the "Tổng quan" screen shows: 30-day performance, lifetime
   * totals, wallet balance and progress towards the next tier.
   */
  /**
   * Where this partner's buyers are going (#012).
   *
   * Same shape as the admin console's "điểm đến mua nhiều": ranked by eSIMs
   * sold, with the revenue behind them, and falling back from destination to
   * region to the plan's country code so a regional plan still lands somewhere.
   */
  async getMyTopDestinations(
    partnerId: number,
    range: { from?: string; to?: string } = {},
    limit = 6,
    /**
     * Whose orders to count (#045). A marketing partner's destinations are the
     * ones their audience bought — orders attributed to them. A distribution
     * partner's are the ones they bought themselves, which is a different set
     * of orders entirely.
     */
    scope: 'attributed' | 'own' = 'attributed',
  ): Promise<{ name: string; plansPurchased: number; revenueVnd: number }[]> {
    const { from, to } = resolveSummaryRange(range);

    let ownerId = partnerId;
    if (scope === 'own') {
      const partner = await this.getPartnerOrThrowById(partnerId);
      ownerId = partner.userId;
    }
    const ownerColumn = scope === 'own' ? 'userId' : 'attributedPartnerId';

    const rows = await this.dataSource.query(
      `SELECT
         COALESCE(d.name, r.name, p."countryCode", 'Không xác định') AS name,
         COALESCE(SUM(oi.quantity), 0) AS "plansPurchased",
         COALESCE(SUM(oi."vndPrice"), 0) AS "revenueVnd"
       FROM "order" o
       JOIN order_item oi ON oi."orderId" = o.id
       JOIN plan p ON p.id = oi."planId"
       LEFT JOIN destination d ON d.id = p."destinationId"
       LEFT JOIN region r ON r.id = p."regionId"
       WHERE o."${ownerColumn}" = $1
         AND o."deletedAt" IS NULL
         AND o."orderType" <> '${TOPUP_ORDER_TYPE}'
         AND o.status IN ('paid', 'completed')
         AND o."createdAt" >= $2 AND o."createdAt" < $3
       GROUP BY 1
       ORDER BY "plansPurchased" DESC, "revenueVnd" DESC
       LIMIT $4`,
      [ownerId, from, to, Math.min(Math.max(limit, 1), 20)],
    );

    return (rows as Record<string, unknown>[]).map((row) => ({
      name: String(row.name ?? 'Không xác định'),
      plansPurchased: Number(row.plansPurchased ?? 0),
      revenueVnd: Number(row.revenueVnd ?? 0),
    }));
  }

  /**
   * The eSIMs this distribution partner has taken delivery of (#046).
   *
   * Their stock: what was bought, what the customer has switched on, and what
   * is still sitting unused. The affiliate screens have nothing like it because
   * a marketing partner never holds stock — they never touch the eSIM at all.
   */
  async getMyEsims(
    partnerId: number,
    filters: { search?: string; status?: string; limit?: number } = {},
  ): Promise<
    {
      iccid: string | null;
      status: string | null;
      planName: string | null;
      destination: string | null;
      orderNumber: string | null;
      costVnd: number;
      dataUsed: number | null;
      dataTotal: number | null;
      activatedAt: string | null;
      expiresAt: string | null;
      createdAt: string | null;
    }[]
  > {
    const partner = await this.getPartnerOrThrowById(partnerId);
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const search = filters.search?.trim() || null;
    const status = filters.status?.trim() || null;

    const rows = await this.dataSource.query(
      `SELECT e.iccid,
              e.status,
              p.name AS "planName",
              COALESCE(d.name, r.name, p."countryCode") AS destination,
              o."orderNumber",
              -- What this one eSIM cost: the line total spread over the line.
              COALESCE(oi."vndPrice" / NULLIF(oi.quantity, 0), 0) AS "costVnd",
              e."dataUsed",
              e."dataTotal",
              e."activatedAt",
              e."expiresAt",
              o."createdAt"
       FROM esim e
       JOIN order_item oi ON oi.id = e."orderItemId"
       JOIN "order" o ON o.id = oi."orderId"
       LEFT JOIN plan p ON p.id = oi."planId"
       LEFT JOIN destination d ON d.id = p."destinationId"
       LEFT JOIN region r ON r.id = p."regionId"
       WHERE o."userId" = $1
         AND o."deletedAt" IS NULL
         AND ($2::text IS NULL OR e.status = $2)
         AND (
           $3::text IS NULL
           OR e.iccid ILIKE '%' || $3 || '%'
           OR o."orderNumber" ILIKE '%' || $3 || '%'
           OR p.name ILIKE '%' || $3 || '%'
         )
       ORDER BY o."createdAt" DESC, e.id DESC
       LIMIT $4`,
      [partner.userId, status, search, limit],
    );

    return (rows as Record<string, any>[]).map((row) => ({
      iccid: row.iccid ?? null,
      status: row.status ?? null,
      planName: row.planName ?? null,
      destination: row.destination ?? null,
      orderNumber: row.orderNumber ?? null,
      costVnd: Number(row.costVnd ?? 0),
      dataUsed: row.dataUsed == null ? null : Number(row.dataUsed),
      dataTotal: row.dataTotal == null ? null : Number(row.dataTotal),
      activatedAt: row.activatedAt ?? null,
      expiresAt: row.expiresAt ?? null,
      createdAt: row.createdAt ?? null,
    }));
  }

  /**
   * The orders this distribution partner placed themselves (#046).
   *
   * `getMyOrders` above answers the marketing question — orders somebody else
   * placed that were credited to this partner. This one is the opposite: the
   * partner's own buying, which is the only kind of order a distribution
   * partner has.
   */
  async getMyPurchases(
    partnerId: number,
    filters: { search?: string; status?: string; limit?: number } = {},
  ): Promise<
    {
      orderNumber: string;
      status: string;
      orderType: string | null;
      paidVnd: number;
      listVnd: number;
      refundedVnd: number;
      esimCount: number;
      createdAt: string;
      items: { planName: string | null; quantity: number; vndPrice: number }[];
    }[]
  > {
    const partner = await this.getPartnerOrThrowById(partnerId);
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const search = filters.search?.trim() || null;
    const status = filters.status?.trim() || null;

    const rows = await this.dataSource.query(
      `SELECT o."orderNumber",
              o.status,
              o."orderType",
              ${ORDER_REVENUE_SQL} AS "paidVnd",
              -- Before any discount, so the page can show what the margin was.
              COALESCE(NULLIF(o."subtotalVndPrice", 0), ${ORDER_REVENUE_SQL}) AS "listVnd",
              COALESCE(o."refundedAmountVnd", 0) AS "refundedVnd",
              o."createdAt",
              COALESCE(
                json_agg(
                  json_build_object(
                    'planName', p.name,
                    'quantity', oi.quantity,
                    'vndPrice', oi."vndPrice"
                  ) ORDER BY oi.id
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'
              ) AS items,
              (
                SELECT count(*)::int FROM esim e
                JOIN order_item oi2 ON oi2.id = e."orderItemId"
                WHERE oi2."orderId" = o.id
              ) AS "esimCount"
       FROM "order" o
       LEFT JOIN order_item oi ON oi."orderId" = o.id
       LEFT JOIN plan p ON p.id = oi."planId"
       WHERE o."userId" = $1
         AND o."deletedAt" IS NULL
         AND ($2::text IS NULL OR o.status = $2)
         AND (
           $3::text IS NULL
           OR o."orderNumber" ILIKE '%' || $3 || '%'
           OR p.name ILIKE '%' || $3 || '%'
         )
       GROUP BY o.id
       ORDER BY o."createdAt" DESC
       LIMIT $4`,
      [partner.userId, status, search, limit],
    );

    return (rows as Record<string, any>[]).map((row) => ({
      orderNumber: String(row.orderNumber),
      status: String(row.status),
      orderType: row.orderType ?? null,
      paidVnd: Number(row.paidVnd ?? 0),
      listVnd: Number(row.listVnd ?? 0),
      refundedVnd: Number(row.refundedVnd ?? 0),
      esimCount: Number(row.esimCount ?? 0),
      createdAt: row.createdAt,
      items: (row.items ?? []).map((item: Record<string, unknown>) => ({
        planName: (item.planName as string) ?? null,
        quantity: Number(item.quantity ?? 0),
        vndPrice: Number(item.vndPrice ?? 0),
      })),
    }));
  }

  /**
   * Orders bought and eSIMs activated over time, for the chart (#045).
   *
   * Two different dates, so two queries: an order counts on the day it was
   * placed, an eSIM on the day the customer switched it on — which is usually a
   * later day, and sometimes a much later one. Bucketed in Postgres so a year
   * of history is a handful of rows rather than a payload the browser has to
   * fold itself.
   */
  async getMyDistributionSeries(
    partnerId: number,
    range: { from?: string; to?: string } = {},
    groupBy: 'day' | 'week' | 'month' | 'year' = 'day',
  ): Promise<{ bucket: string; orders: number; activatedEsims: number }[]> {
    const partner = await this.getPartnerOrThrowById(partnerId);
    const { from, to } = resolveSummaryRange(range);
    // Never interpolated from the caller: one of four known words.
    const unit = ['day', 'week', 'month', 'year'].includes(groupBy)
      ? groupBy
      : 'day';

    const orderRows = await this.dataSource.query(
      `SELECT date_trunc('${unit}', o."createdAt") AS bucket,
              COUNT(*) AS orders
       FROM "order" o
       WHERE o."userId" = $1
         AND o."deletedAt" IS NULL
         AND o.status = ANY($4)
         AND o."createdAt" >= $2 AND o."createdAt" < $3
       GROUP BY 1`,
      [partner.userId, from, to, SETTLED_ORDER_STATUS_LIST],
    );

    const esimRows = await this.dataSource.query(
      `SELECT date_trunc('${unit}', e."activatedAt") AS bucket,
              COUNT(*) AS "activatedEsims"
       FROM esim e
       JOIN order_item oi ON oi.id = e."orderItemId"
       JOIN "order" o ON o.id = oi."orderId"
       WHERE o."userId" = $1
         AND o."deletedAt" IS NULL
         AND e."activatedAt" IS NOT NULL
         AND e."activatedAt" >= $2 AND e."activatedAt" < $3
       GROUP BY 1`,
      [partner.userId, from, to],
    );

    const merged = new Map<
      string,
      { orders: number; activatedEsims: number }
    >();
    const bucketKey = (value: unknown) =>
      new Date(value as string).toISOString();

    for (const row of orderRows as Record<string, unknown>[]) {
      const key = bucketKey(row.bucket);
      merged.set(key, {
        orders: Number(row.orders ?? 0),
        activatedEsims: merged.get(key)?.activatedEsims ?? 0,
      });
    }
    for (const row of esimRows as Record<string, unknown>[]) {
      const key = bucketKey(row.bucket);
      merged.set(key, {
        orders: merged.get(key)?.orders ?? 0,
        activatedEsims: Number(row.activatedEsims ?? 0),
      });
    }

    return [...merged.entries()]
      .map(([bucket, counts]) => ({ bucket, ...counts }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));
  }

  /**
   * Dashboard read model for a distribution partner (#043).
   *
   * A different business from the marketing side, so a different dashboard. A
   * marketing partner earns commission on orders somebody else placed; a
   * distribution partner buys the eSIMs themselves and resells them, so what
   * they need to see is their own buying: how many orders, how many fell over,
   * what they spent, split between eSIMs and top-ups — and how many of the
   * eSIMs they bought have actually been activated, because an unactivated
   * eSIM is stock, not a sale.
   *
   * "Doanh thu" here is what the partner spent with esim.vn, which is the same
   * number esim.vn books as revenue from them (#050).
   */
  async getMyDistributionSummary(
    partnerId: number,
    range: { from?: string; to?: string } = {},
  ) {
    const partner = await this.getPartnerOrThrowById(partnerId);
    const { from, to } = resolveSummaryRange(range);

    // Their own purchases — not orders attributed to them, which is the
    // marketing side's question.
    const [orders] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE o."orderType" <> $4) AS "esimOrders",
         COUNT(*) FILTER (WHERE o."orderType" <> $4 AND o.status = ANY($5)) AS "esimCancelled",
         COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (
           WHERE o."orderType" <> $4 AND o.status = ANY($6)
         ), 0) AS "esimRevenueVnd",
         COUNT(*) FILTER (WHERE o."orderType" = $4) AS "topupOrders",
         COUNT(*) FILTER (WHERE o."orderType" = $4 AND o.status = ANY($5)) AS "topupCancelled",
         COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (
           WHERE o."orderType" = $4 AND o.status = ANY($6)
         ), 0) AS "topupRevenueVnd"
       FROM "order" o
       WHERE o."userId" = $1
         AND o."deletedAt" IS NULL
         AND o."createdAt" >= $2
         AND o."createdAt" < $3`,
      [
        partner.userId,
        from,
        to,
        TOPUP_ORDER_TYPE,
        DEAD_ORDER_STATUS_LIST,
        SETTLED_ORDER_STATUS_LIST,
      ],
    );

    // An eSIM the customer never switched on is stock the partner is still
    // holding, so it is counted apart from what they bought.
    const [esims] = await this.dataSource.query(
      `SELECT
         COUNT(*) AS "activatedCount",
         -- order_item."vndPrice" is the line total, so one eSIM out of a line
         -- of five is worth a fifth of it.
         COALESCE(
           SUM(oi."vndPrice" / NULLIF(oi.quantity, 0)),
           0
         ) AS "activatedRevenueVnd"
       FROM esim e
       JOIN order_item oi ON oi.id = e."orderItemId"
       JOIN "order" o ON o.id = oi."orderId"
       WHERE o."userId" = $1
         AND o."deletedAt" IS NULL
         AND e."activatedAt" IS NOT NULL
         AND e."activatedAt" >= $2
         AND e."activatedAt" < $3`,
      [partner.userId, from, to],
    );

    const esimOrders = Number(orders?.esimOrders ?? 0);
    const topupOrders = Number(orders?.topupOrders ?? 0);
    const esimRevenueVnd = Number(orders?.esimRevenueVnd ?? 0);
    const topupRevenueVnd = Number(orders?.topupRevenueVnd ?? 0);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      /** eSIM purchases and top-ups added together — the header figures. */
      total: {
        orders: esimOrders + topupOrders,
        cancelledOrders:
          Number(orders?.esimCancelled ?? 0) +
          Number(orders?.topupCancelled ?? 0),
        revenueVnd: esimRevenueVnd + topupRevenueVnd,
      },
      esim: {
        orders: esimOrders,
        cancelledOrders: Number(orders?.esimCancelled ?? 0),
        revenueVnd: esimRevenueVnd,
      },
      topup: {
        orders: topupOrders,
        cancelledOrders: Number(orders?.topupCancelled ?? 0),
        revenueVnd: topupRevenueVnd,
      },
      /** eSIMs the end customer switched on inside the window. */
      activatedEsims: {
        count: Number(esims?.activatedCount ?? 0),
        revenueVnd: Number(esims?.activatedRevenueVnd ?? 0),
      },
    };
  }

  /**
   * Dashboard read model for one partner, over a period they choose (#010).
   *
   * `from`/`to` are inclusive day bounds; with neither, the window is the last
   * 30 days, which is what the dashboard opened with before it had a filter.
   */
  async getMySummary(
    partnerId: number,
    range: { from?: string; to?: string } = {},
  ) {
    const partner = await this.getPartnerOrThrowById(partnerId);
    const { from, to } = resolveSummaryRange(range);

    const [perf] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (WHERE o."createdAt" >= $2 AND o."createdAt" < $3), 0) AS "revenue30",
         COUNT(*)          FILTER (WHERE o."createdAt" >= $2 AND o."createdAt" < $3) AS "orders30",
         COALESCE(SUM(${ORDER_REVENUE_SQL}), 0) AS "revenueTotal",
         COUNT(*) AS "ordersTotal"
       FROM "order" o
       WHERE o."attributedPartnerId" = $1
         AND o."deletedAt" IS NULL
         AND o."orderType" <> '${TOPUP_ORDER_TYPE}'
         AND o.status IN ('paid', 'completed')`,
      [partnerId, from, to],
    );

    const [comm] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(c."commissionVnd") FILTER (WHERE c."createdAt" >= $2 AND c."createdAt" < $3), 0) AS "commission30",
         COALESCE(SUM(c."commissionVnd"), 0) AS "commissionTotal",
         COALESCE(SUM(c."commissionVnd") FILTER (WHERE c.status = 'pending'), 0) AS "commissionPending"
       FROM order_partner_commission c
       JOIN "order" o ON o.id = c."orderId"
       WHERE c."partnerId" = $1
         AND c.status <> 'reversed'
         -- Historical rows from before top-ups stopped earning (#025).
         AND o."orderType" <> '${TOPUP_ORDER_TYPE}'`,
      [partnerId, from, to],
    );

    const [clicks] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE k."clickedAt" >= $2 AND k."clickedAt" < $3) AS "clicks30",
         COUNT(*) AS "clicksTotal"
       FROM partner_link_click k
       JOIN partner_link l ON l.id = k."linkId"
       WHERE l."partnerId" = $1`,
      [partnerId, from, to],
    );

    // New vs returning buyers behind this partner's orders (#011). "Mới" is
    // read from the buyer's own account history: their first paid order on
    // esim.vn ever, not merely their first through this partner — otherwise
    // every partner would report the same customer as new.
    const [customers] = await this.dataSource.query(
      `WITH buyers AS (
         SELECT o."userId" AS user_id, MIN(o."createdAt") AS first_in_range
         FROM "order" o
         WHERE o."attributedPartnerId" = $1
           AND o."deletedAt" IS NULL
           AND o."orderType" <> '${TOPUP_ORDER_TYPE}'
           AND o.status IN ('paid', 'completed')
           AND o."createdAt" >= $2 AND o."createdAt" < $3
         GROUP BY o."userId"
       )
       SELECT
         COUNT(*) FILTER (WHERE earlier.id IS NULL) AS "newCustomers",
         COUNT(*) FILTER (WHERE earlier.id IS NOT NULL) AS "returningCustomers"
       FROM buyers b
       LEFT JOIN LATERAL (
         SELECT e.id
         FROM "order" e
         WHERE e."userId" = b.user_id
           AND e."deletedAt" IS NULL
           AND e.status IN ('paid', 'completed')
           AND e."createdAt" < b.first_in_range
         LIMIT 1
       ) earlier ON true`,
      [partnerId, from, to],
    );

    // Same span of this month against last month — "cùng kỳ tháng trước"
    // (#008). Comparing whole months would flatter the 1st of the month and
    // punish the 2nd, which is not what the partner is being shown.
    const [mom] = await this.dataSource.query(
      `WITH bounds AS (
         SELECT
           date_trunc('month', now()) AS this_start,
           date_trunc('month', now() - INTERVAL '1 month') AS prev_start,
           date_trunc('month', now() - INTERVAL '1 month')
             + (now() - date_trunc('month', now())) AS prev_cutoff
       )
       SELECT
         COALESCE(SUM(c."commissionVnd") FILTER (
           WHERE c."createdAt" >= b.this_start), 0) AS "commissionThis",
         COALESCE(SUM(c."commissionVnd") FILTER (
           WHERE c."createdAt" >= b.prev_start AND c."createdAt" < b.prev_cutoff), 0)
           AS "commissionPrev"
       FROM order_partner_commission c
       CROSS JOIN bounds b
       WHERE c."partnerId" = $1 AND c.status <> 'reversed'`,
      [partnerId],
    );

    const wallet = await this.getWalletSummaryForPartner(partnerId);
    const tiers = await this.tierRepository.find({
      where: { partnerType: partner.partnerType, isActive: true },
      order: { sortOrder: 'ASC', minVolumeVnd: 'ASC' },
    });
    const currentTier =
      tiers.find((t) => t.tierCode === partner.tierCode) ?? null;
    const nextTier =
      tiers.find(
        (t) => Number(t.minVolumeVnd) > Number(currentTier?.minVolumeVnd ?? -1),
      ) ?? null;

    const revenueTotal = Number(perf?.revenueTotal ?? 0);
    const toNextTierVnd = nextTier
      ? Math.max(0, Number(nextTier.minVolumeVnd) - revenueTotal)
      : 0;

    return {
      /** The window the figures below cover, echoed back for the header. */
      range: { from: from.toISOString(), to: to.toISOString() },
      performance: {
        clicks: Number(clicks?.clicks30 ?? 0),
        orders: Number(perf?.orders30 ?? 0),
        revenueVnd: Number(perf?.revenue30 ?? 0),
        commissionVnd: Number(comm?.commission30 ?? 0),
      },
      lifetime: {
        clicks: Number(clicks?.clicksTotal ?? 0),
        orders: Number(perf?.ordersTotal ?? 0),
        revenueVnd: revenueTotal,
        commissionVnd: Number(comm?.commissionTotal ?? 0),
      },
      /** Buyers in the window, split by whether esim.vn had seen them before (#011). */
      customers: {
        newCount: Number(customers?.newCustomers ?? 0),
        returningCount: Number(customers?.returningCustomers ?? 0),
      },
      commissionPendingVnd: Number(comm?.commissionPending ?? 0),
      /** This month so far vs the same days of last month (#008). */
      monthOverMonth: {
        commissionVnd: Number(mom?.commissionThis ?? 0),
        previousCommissionVnd: Number(mom?.commissionPrev ?? 0),
        commissionGrowthPercent: growthPercent(
          Number(mom?.commissionThis ?? 0),
          Number(mom?.commissionPrev ?? 0),
        ),
      },
      wallet,
      tier: {
        current: currentTier,
        next: nextTier,
        /**
         * When this tier took effect (#042). Orders placed before it kept the
         * rate of the tier the partner was on then — nothing is recalculated
         * backwards, and this is the date that says where the line falls.
         */
        effectiveFrom: partner.tierEffectiveFrom
          ? partner.tierEffectiveFrom.toISOString()
          : null,
        toNextTierVnd,
        /** 0–100, how far this partner is towards `next`. */
        progressPercent: nextTier
          ? Math.min(
              100,
              Math.round(
                (revenueTotal / Math.max(1, Number(nextTier.minVolumeVnd))) *
                  100,
              ),
            )
          : 100,
      },
    };
  }

  /**
   * The numbers behind the admin partner list (#095).
   *
   * The brief asks for "tổng Đơn hàng, tổng Doanh thu, Lợi nhuận, tỷ lệ đơn
   * Hoàn tiền"; the list only had a 30-day revenue figure, so an admin could
   * not tell a partner who has sold steadily for a year from one who had a good
   * month, nor see that a partner's orders keep coming back as refunds.
   *
   * Definitions chosen here, since the brief only names the columns:
   *   • revenue/profit count paid and completed orders;
   *   • profit is revenue less cost of goods less the commission we paid that
   *     partner — what they actually contributed to the bottom line;
   *   • the refund rate is by ORDER COUNT ("tỷ lệ đơn"), over every order that
   *     was ever paid, so refunds stay in the denominator.
   *
   * Still one aggregate query for the whole page.
   */
  private async attachAdminListMetrics(
    partners: PartnerEntity[],
  ): Promise<AdminPartnerListRow[]> {
    if (partners.length === 0) return [];
    const ids = partners.map((p) => p.id);

    const rows = await this.dataSource.query(
      `SELECT p.id AS "partnerId",
              COALESCE(w."balanceVnd", 0) AS "walletBalanceVnd",
              COALESCE((
                SELECT SUM(${ORDER_REVENUE_SQL}) FROM "order" o
                WHERE o."attributedPartnerId" = p.id
                  AND o."deletedAt" IS NULL
                  AND o.status IN ('paid', 'completed')
                  AND o."createdAt" >= now() - INTERVAL '30 days'
              ), 0) AS "revenue30dVnd",
              COALESCE(t."totalOrders", 0) AS "totalOrders",
              COALESCE(t."totalRevenueVnd", 0) AS "totalRevenueVnd",
              COALESCE(t."grossProfitVnd", 0)
                - COALESCE(c."commissionVnd", 0) AS "profitVnd",
              COALESCE(c."commissionVnd", 0) AS "totalCommissionVnd",
              COALESCE(t."refundedOrders", 0) AS "refundedOrders",
              COALESCE(t."settledOrders", 0) AS "settledOrders",
              (
                SELECT MAX(o."createdAt") FROM "order" o
                WHERE o."attributedPartnerId" = p.id AND o."deletedAt" IS NULL
              ) AS "lastOrderAt",
              -- "hoạt động gần nhất" is when they last signed in (#060), not
              -- when an order last happened to arrive through their link.
              u."lastLoginAt" AS "lastLoginAt",
              -- What they could actually withdraw or spend: the balance less
              -- anything already claimed and waiting (#060).
              GREATEST(
                COALESCE(w."balanceVnd", 0) - COALESCE(pp."pendingPayoutVnd", 0),
                0
              ) AS "availableBalanceVnd"
       FROM partner p
       LEFT JOIN partner_wallet w ON w."partnerId" = p.id
       LEFT JOIN "user" u ON u.id = p."userId"
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(pay."amountVnd"), 0) AS "pendingPayoutVnd"
         FROM partner_payout pay
         WHERE pay."partnerId" = p.id AND pay.status = 'pending'
       ) pp ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (
                  WHERE o.status IN ('paid', 'completed')
                ) AS "totalOrders",
                COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (
                  WHERE o.status IN ('paid', 'completed')
                ), 0) AS "totalRevenueVnd",
                COALESCE(SUM(${ORDER_REVENUE_SQL} - COALESCE(o."vndCostPrice", 0)) FILTER (
                  WHERE o.status IN ('paid', 'completed')
                ), 0) AS "grossProfitVnd",
                COUNT(*) FILTER (WHERE o.status = 'refunded') AS "refundedOrders",
                COUNT(*) FILTER (
                  WHERE o.status IN ('paid', 'completed', 'refunded')
                ) AS "settledOrders"
         FROM "order" o
         WHERE o."attributedPartnerId" = p.id AND o."deletedAt" IS NULL
       ) t ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(opc."commissionVnd"), 0) AS "commissionVnd"
         FROM order_partner_commission opc
         WHERE opc."partnerId" = p.id AND opc.status = 'credited'
       ) c ON TRUE
       WHERE p.id = ANY($1)`,
      [ids],
    );

    const byId = new Map<number, Record<string, any>>(
      rows.map((r: Record<string, any>) => [Number(r.partnerId), r]),
    );

    return partners.map((p) => {
      const m = byId.get(p.id);
      const settled = Number(m?.settledOrders ?? 0);
      const refunded = Number(m?.refundedOrders ?? 0);
      return Object.assign(p, {
        walletBalanceVnd: Number(m?.walletBalanceVnd ?? 0),
        availableBalanceVnd: Number(m?.availableBalanceVnd ?? 0),
        revenue30dVnd: Number(m?.revenue30dVnd ?? 0),
        // The sign-in is the answer the brief asks for; the last order is kept
        // as a fallback for accounts that predate the column (#060).
        lastActivityAt: m?.lastLoginAt ?? m?.lastOrderAt ?? null,
        lastLoginAt: m?.lastLoginAt ?? null,
        lastOrderAt: m?.lastOrderAt ?? null,
        totalOrders: Number(m?.totalOrders ?? 0),
        totalRevenueVnd: Number(m?.totalRevenueVnd ?? 0),
        profitVnd: Number(m?.profitVnd ?? 0),
        totalCommissionVnd: Number(m?.totalCommissionVnd ?? 0),
        // A partner with no orders has no refund rate — 0, never a division by
        // zero showing up as NaN in the table.
        refundRatePercent:
          settled > 0 ? Math.round((refunded / settled) * 1000) / 10 : 0,
      });
    });
  }

  /** Numbers behind the admin "Tổng quan đối tác" screen. */
  /**
   * What esim.vn actually keeps from each kind of partner (#050).
   *
   * Not what the orders were rung up at: "doanh thu của đối tác là số tiền mà
   * esim.vn thu về thực tế". For a marketing partner that is the order value
   * less the commission paid away; for a distribution or API partner it is what
   * they paid us for the eSIMs — their buying price *is* our revenue.
   *
   * Both halves are measured for every type rather than assumed, because a
   * distribution partner granted the affiliate programme (#048) earns on both
   * sides. An order is only counted once: a partner's own purchase that was
   * credited to somebody else belongs to that somebody else.
   */
  async adminRevenueByPartnerType(
    range: { from?: string; to?: string } = {},
  ): Promise<{
    range: { from: string; to: string };
    previousRange: { from: string; to: string };
    byType: {
      partnerType: string;
      partners: number;
      revenueVnd: number;
      previousRevenueVnd: number;
      growthPercent: number;
      /** Order value credited to them, before commission was paid away. */
      attributedGrossVnd: number;
      commissionVnd: number;
      /** What they paid us for stock. */
      purchasesVnd: number;
    }[];
    totalRevenueVnd: number;
    previousTotalRevenueVnd: number;
    growthPercent: number;
  }> {
    const { from, to } = resolveSummaryRange(range);
    // The same span again, ending where this one starts: comparing a week to a
    // month would make any number look like growth.
    const spanMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - spanMs);
    const prevTo = from;

    const params = [from, to, prevFrom, prevTo, SETTLED_ORDER_STATUS_LIST];

    // The affiliate side: orders credited to a partner, net of what we paid
    // them for it. A reversed commission was never paid, so it comes back.
    const attributed = await this.dataSource.query(
      `SELECT p."partnerType" AS "partnerType",
              COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (
                WHERE o."createdAt" >= $1 AND o."createdAt" < $2), 0) AS "grossVnd",
              COALESCE(SUM(
                COALESCE(c."commissionVnd", 0) - COALESCE(c."reversedCommissionVnd", 0)
              ) FILTER (WHERE o."createdAt" >= $1 AND o."createdAt" < $2), 0) AS "commissionVnd",
              COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (
                WHERE o."createdAt" >= $3 AND o."createdAt" < $4), 0) AS "prevGrossVnd",
              COALESCE(SUM(
                COALESCE(c."commissionVnd", 0) - COALESCE(c."reversedCommissionVnd", 0)
              ) FILTER (WHERE o."createdAt" >= $3 AND o."createdAt" < $4), 0) AS "prevCommissionVnd"
       FROM "order" o
       JOIN partner p ON p.id = o."attributedPartnerId"
       LEFT JOIN order_partner_commission c
         ON c."orderId" = o.id AND c.status <> 'reversed'
       WHERE o."deletedAt" IS NULL
         AND o.status = ANY($5)
         AND o."createdAt" >= $3 AND o."createdAt" < $2
       GROUP BY 1`,
      params,
    );

    // The distribution side: what the partner paid us. An order of theirs that
    // was credited to another partner is that partner's, not theirs, so it is
    // left out here and counted above.
    const purchases = await this.dataSource.query(
      `SELECT p."partnerType" AS "partnerType",
              COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (
                WHERE o."createdAt" >= $1 AND o."createdAt" < $2), 0) AS "purchasesVnd",
              COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (
                WHERE o."createdAt" >= $3 AND o."createdAt" < $4), 0) AS "prevPurchasesVnd"
       FROM "order" o
       JOIN partner p ON p."userId" = o."userId"
       WHERE o."deletedAt" IS NULL
         AND o.status = ANY($5)
         AND (o."attributedPartnerId" IS NULL OR o."attributedPartnerId" = p.id)
         AND o."createdAt" >= $3 AND o."createdAt" < $2
       GROUP BY 1`,
      params,
    );

    const counts = await this.dataSource.query(
      `SELECT "partnerType", COUNT(*) AS "partners"
       FROM partner
       WHERE "deletedAt" IS NULL AND status <> 'rejected'
       GROUP BY 1`,
    );

    const n = (v: unknown) => Number(v ?? 0);
    const types = new Set<string>([
      ...(counts as Record<string, any>[]).map((r) => String(r.partnerType)),
      ...(attributed as Record<string, any>[]).map((r) =>
        String(r.partnerType),
      ),
      ...(purchases as Record<string, any>[]).map((r) => String(r.partnerType)),
    ]);

    const byType = [...types].sort().map((partnerType) => {
      const a = (attributed as Record<string, any>[]).find(
        (r) => r.partnerType === partnerType,
      );
      const b = (purchases as Record<string, any>[]).find(
        (r) => r.partnerType === partnerType,
      );
      const c = (counts as Record<string, any>[]).find(
        (r) => r.partnerType === partnerType,
      );

      const attributedGrossVnd = n(a?.grossVnd);
      const commissionVnd = n(a?.commissionVnd);
      const purchasesVnd = n(b?.purchasesVnd);
      const revenueVnd = attributedGrossVnd - commissionVnd + purchasesVnd;
      const previousRevenueVnd =
        n(a?.prevGrossVnd) - n(a?.prevCommissionVnd) + n(b?.prevPurchasesVnd);

      return {
        partnerType,
        partners: n(c?.partners),
        revenueVnd,
        previousRevenueVnd,
        growthPercent: growthPercent(revenueVnd, previousRevenueVnd),
        attributedGrossVnd,
        commissionVnd,
        purchasesVnd,
      };
    });

    const totalRevenueVnd = byType.reduce((sum, r) => sum + r.revenueVnd, 0);
    const previousTotalRevenueVnd = byType.reduce(
      (sum, r) => sum + r.previousRevenueVnd,
      0,
    );

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      previousRange: { from: prevFrom.toISOString(), to: prevTo.toISOString() },
      byType,
      totalRevenueVnd,
      previousTotalRevenueVnd,
      growthPercent: growthPercent(totalRevenueVnd, previousTotalRevenueVnd),
    };
  }

  /**
   * Orders, live partners and what is waiting to be settled (#051).
   *
   * "Đang hoạt động" here is not the status field: the brief defines it as a
   * partner who has transacted in the last 30 days. A partner approved a year
   * ago who has not sent an order since is active on paper and dormant in fact,
   * and the second is the number worth putting on a dashboard.
   *
   * A transaction is either side of the business: an order credited to them, or
   * one they placed themselves.
   */
  async adminPartnerActivity(
    range: { from?: string; to?: string } = {},
  ): Promise<{
    range: { from: string; to: string };
    orders: {
      total: number;
      byType: { partnerType: string; orders: number }[];
    };
    activePartners: {
      total: number;
      byType: { partnerType: string; partners: number }[];
    };
    pendingApprovals: {
      total: number;
      byType: { partnerType: string; partners: number }[];
    };
    commissionToReconcile: { totalVnd: number; partners: number };
  }> {
    const { from, to } = resolveSummaryRange(range);
    const params = [from, to, SETTLED_ORDER_STATUS_LIST];

    // One row per partner per order, from either side, so a partner is counted
    // once however the order reached them.
    const PARTNER_ORDERS_SQL = `
      SELECT p.id AS "partnerId", p."partnerType" AS "partnerType", o.id AS "orderId"
      FROM "order" o
      JOIN partner p
        ON p.id = o."attributedPartnerId"
        OR (p."userId" = o."userId"
            AND (o."attributedPartnerId" IS NULL OR o."attributedPartnerId" = p.id))
      WHERE o."deletedAt" IS NULL
        AND o.status = ANY($3)
        AND o."createdAt" >= $1 AND o."createdAt" < $2
        AND p."deletedAt" IS NULL`;

    const orderRows = await this.dataSource.query(
      `SELECT "partnerType", COUNT(DISTINCT "orderId") AS orders
       FROM (${PARTNER_ORDERS_SQL}) t
       GROUP BY 1`,
      params,
    );

    const activeRows = await this.dataSource.query(
      `SELECT "partnerType", COUNT(DISTINCT "partnerId") AS partners
       FROM (${PARTNER_ORDERS_SQL}) t
       GROUP BY 1`,
      params,
    );

    const pendingRows = await this.dataSource.query(
      `SELECT "partnerType", COUNT(*) AS partners
       FROM partner
       WHERE "deletedAt" IS NULL AND status = 'pending'
       GROUP BY 1`,
    );

    // Earned but not yet credited: the order is done, reconciliation is not.
    const [reconcile] = await this.dataSource.query(
      `SELECT COALESCE(SUM("commissionVnd"), 0) AS "totalVnd",
              COUNT(DISTINCT "partnerId") AS partners
       FROM order_partner_commission
       WHERE status = $1`,
      [OrderPartnerCommissionStatusEnum.PENDING],
    );

    const n = (v: unknown) => Number(v ?? 0);
    const byType = (rows: Record<string, any>[], key: 'orders' | 'partners') =>
      rows
        .map((r) => ({ partnerType: String(r.partnerType), [key]: n(r[key]) }))
        .sort((a, b) => a.partnerType.localeCompare(b.partnerType)) as never;

    const sum = (rows: Record<string, any>[], key: string) =>
      rows.reduce((total, r) => total + n(r[key]), 0);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      orders: {
        total: sum(orderRows, 'orders'),
        byType: byType(orderRows, 'orders'),
      },
      activePartners: {
        total: sum(activeRows, 'partners'),
        byType: byType(activeRows, 'partners'),
      },
      pendingApprovals: {
        total: sum(pendingRows, 'partners'),
        byType: byType(pendingRows, 'partners'),
      },
      commissionToReconcile: {
        totalVnd: n(reconcile?.totalVnd),
        partners: n(reconcile?.partners),
      },
    };
  }

  /**
   * Revenue and order count over time, split by partner type (#052).
   *
   * The same money as #050 — what esim.vn keeps, not what the orders were rung
   * up at — cut by bucket so the shape of a month is visible rather than one
   * number for it. Bucketed in Postgres: a year by day is a few hundred rows
   * either way, but folding it here would mean shipping every order to do it.
   */
  async adminPartnerSeries(
    range: { from?: string; to?: string } = {},
    groupBy: 'day' | 'week' | 'month' | 'year' = 'day',
  ): Promise<{
    range: { from: string; to: string };
    points: {
      bucket: string;
      byType: { partnerType: string; revenueVnd: number; orders: number }[];
    }[];
  }> {
    const { from, to } = resolveSummaryRange(range);
    // Never interpolated from the caller: one of four known words.
    const unit = ['day', 'week', 'month', 'year'].includes(groupBy)
      ? groupBy
      : 'day';
    const params = [from, to, SETTLED_ORDER_STATUS_LIST];

    // Attributed orders net of commission, and the partner's own purchases,
    // in one pass. An order reaches a partner from one side or the other; the
    // union keys off which, so nothing is counted twice.
    const rows = await this.dataSource.query(
      `SELECT date_trunc('${unit}', t."createdAt") AS bucket,
              t."partnerType",
              COALESCE(SUM(t."revenueVnd"), 0) AS "revenueVnd",
              COUNT(DISTINCT t."orderId") AS orders
       FROM (
         SELECT o.id AS "orderId", o."createdAt", p."partnerType",
                ${ORDER_REVENUE_SQL} - COALESCE(
                  (SELECT c."commissionVnd" - COALESCE(c."reversedCommissionVnd", 0)
                   FROM order_partner_commission c
                   WHERE c."orderId" = o.id AND c.status <> 'reversed'), 0
                ) AS "revenueVnd"
         FROM "order" o
         JOIN partner p ON p.id = o."attributedPartnerId"
         WHERE o."deletedAt" IS NULL AND o.status = ANY($3)
           AND o."createdAt" >= $1 AND o."createdAt" < $2

         UNION ALL

         SELECT o.id AS "orderId", o."createdAt", p."partnerType",
                ${ORDER_REVENUE_SQL} AS "revenueVnd"
         FROM "order" o
         JOIN partner p ON p."userId" = o."userId"
         WHERE o."deletedAt" IS NULL AND o.status = ANY($3)
           AND (o."attributedPartnerId" IS NULL OR o."attributedPartnerId" = p.id)
           AND o."createdAt" >= $1 AND o."createdAt" < $2
       ) t
       GROUP BY 1, 2
       ORDER BY 1`,
      params,
    );

    const byBucket = new Map<
      string,
      { partnerType: string; revenueVnd: number; orders: number }[]
    >();
    for (const row of rows as Record<string, any>[]) {
      const key = new Date(row.bucket as string).toISOString();
      const list = byBucket.get(key) ?? [];
      list.push({
        partnerType: String(row.partnerType),
        revenueVnd: Number(row.revenueVnd ?? 0),
        orders: Number(row.orders ?? 0),
      });
      byBucket.set(key, list);
    }

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      points: [...byBucket.entries()]
        .map(([bucket, byType]) => ({
          bucket,
          byType: byType.sort((a, b) =>
            a.partnerType.localeCompare(b.partnerType),
          ),
        }))
        .sort((a, b) => a.bucket.localeCompare(b.bucket)),
    };
  }

  /**
   * Where partner-driven orders are going (#052).
   *
   * The admin console already ranks destinations for the shop as a whole; this
   * is the same question asked of the partner programme only, which is the one
   * an admin is on this screen to answer.
   */
  async adminPartnerTopDestinations(
    range: { from?: string; to?: string } = {},
    limit = 8,
  ): Promise<{ name: string; plansPurchased: number; revenueVnd: number }[]> {
    const { from, to } = resolveSummaryRange(range);

    const rows = await this.dataSource.query(
      `SELECT COALESCE(d.name, r.name, p."countryCode", 'Không xác định') AS name,
              COALESCE(SUM(oi.quantity), 0) AS "plansPurchased",
              COALESCE(SUM(oi."vndPrice"), 0) AS "revenueVnd"
       FROM "order" o
       JOIN order_item oi ON oi."orderId" = o.id
       JOIN plan p ON p.id = oi."planId"
       LEFT JOIN destination d ON d.id = p."destinationId"
       LEFT JOIN region r ON r.id = p."regionId"
       WHERE o."deletedAt" IS NULL
         AND o.status = ANY($3)
         AND o."createdAt" >= $1 AND o."createdAt" < $2
         AND (
           o."attributedPartnerId" IS NOT NULL
           OR EXISTS (
             SELECT 1 FROM partner pa
             WHERE pa."userId" = o."userId" AND pa."deletedAt" IS NULL
           )
         )
       GROUP BY 1
       ORDER BY "plansPurchased" DESC, "revenueVnd" DESC
       LIMIT $4`,
      [from, to, SETTLED_ORDER_STATUS_LIST, Math.min(Math.max(limit, 1), 30)],
    );

    return (rows as Record<string, any>[]).map((row) => ({
      name: String(row.name ?? 'Không xác định'),
      plansPurchased: Number(row.plansPurchased ?? 0),
      revenueVnd: Number(row.revenueVnd ?? 0),
    }));
  }

  /**
   * The partners bringing in the most, for the foot of the overview (#054).
   *
   * Ranked on the same money as everything else on that screen — what esim.vn
   * keeps — so the table and the totals above it cannot tell different stories.
   * Thirty rows because the brief asks for thirty: enough to see the long tail
   * rather than only the names everyone already knows.
   */
  async adminTopPartners(
    range: { from?: string; to?: string } = {},
    limit = 30,
  ): Promise<
    {
      id: number;
      contactName: string | null;
      partnerType: string;
      tierCode: string | null;
      status: string;
      revenueVnd: number;
      orders: number;
      commissionVnd: number;
    }[]
  > {
    const { from, to } = resolveSummaryRange(range);

    const rows = await this.dataSource.query(
      `SELECT p.id,
              p."contactName",
              p."partnerType",
              p."tierCode",
              p.status,
              COALESCE(SUM(t."revenueVnd"), 0) AS "revenueVnd",
              COALESCE(SUM(t."commissionVnd"), 0) AS "commissionVnd",
              COUNT(DISTINCT t."orderId") AS orders
       FROM partner p
       JOIN (
         SELECT o.id AS "orderId", o."attributedPartnerId" AS "partnerId",
                ${ORDER_REVENUE_SQL} - COALESCE(
                  (SELECT c."commissionVnd" - COALESCE(c."reversedCommissionVnd", 0)
                   FROM order_partner_commission c
                   WHERE c."orderId" = o.id AND c.status <> 'reversed'), 0
                ) AS "revenueVnd",
                COALESCE(
                  (SELECT c."commissionVnd" - COALESCE(c."reversedCommissionVnd", 0)
                   FROM order_partner_commission c
                   WHERE c."orderId" = o.id AND c.status <> 'reversed'), 0
                ) AS "commissionVnd"
         FROM "order" o
         WHERE o."deletedAt" IS NULL AND o.status = ANY($3)
           AND o."attributedPartnerId" IS NOT NULL
           AND o."createdAt" >= $1 AND o."createdAt" < $2

         UNION ALL

         SELECT o.id AS "orderId", pa.id AS "partnerId",
                ${ORDER_REVENUE_SQL} AS "revenueVnd",
                0 AS "commissionVnd"
         FROM "order" o
         JOIN partner pa ON pa."userId" = o."userId" AND pa."deletedAt" IS NULL
         WHERE o."deletedAt" IS NULL AND o.status = ANY($3)
           AND (o."attributedPartnerId" IS NULL OR o."attributedPartnerId" = pa.id)
           AND o."createdAt" >= $1 AND o."createdAt" < $2
       ) t ON t."partnerId" = p.id
       WHERE p."deletedAt" IS NULL
       GROUP BY p.id
       ORDER BY "revenueVnd" DESC
       LIMIT $4`,
      [from, to, SETTLED_ORDER_STATUS_LIST, Math.min(Math.max(limit, 1), 100)],
    );

    return (rows as Record<string, any>[]).map((row) => ({
      id: Number(row.id),
      contactName: row.contactName ?? null,
      partnerType: String(row.partnerType),
      tierCode: row.tierCode ?? null,
      status: String(row.status),
      revenueVnd: Number(row.revenueVnd ?? 0),
      orders: Number(row.orders ?? 0),
      commissionVnd: Number(row.commissionVnd ?? 0),
    }));
  }

  /**
   * The four figures at the head of the partner list (#057).
   *
   * All four are about the state of the accounts themselves, which is what that
   * page is a list of — not about who traded recently, which is the overview's
   * question (#051). Locked accounts are left out of the total because the
   * brief says so: a total that counts accounts nobody can use overstates the
   * programme.
   */
  async adminPartnerListStats(): Promise<{
    total: { count: number; byType: { partnerType: string; count: number }[] };
    active: {
      count: number;
      percentOfTotal: number;
      byType: { partnerType: string; count: number }[];
    };
    newThisMonth: {
      count: number;
      byType: { partnerType: string; count: number }[];
    };
    onHold: { count: number; byType: { partnerType: string; count: number }[] };
  }> {
    const rows = await this.dataSource.query(
      `SELECT "partnerType",
              COUNT(*) FILTER (WHERE status <> $1) AS "total",
              COUNT(*) FILTER (WHERE status = $2) AS "active",
              COUNT(*) FILTER (WHERE status = $3) AS "onHold",
              COUNT(*) FILTER (
                WHERE status <> $1
                  AND "createdAt" >= date_trunc('month', now())
              ) AS "newThisMonth"
       FROM partner
       WHERE "deletedAt" IS NULL
       GROUP BY 1`,
      [
        PartnerStatusEnum.DISABLED,
        PartnerStatusEnum.ACTIVE,
        PartnerStatusEnum.HOLD,
      ],
    );

    const n = (v: unknown) => Number(v ?? 0);
    const typed = (rows as Record<string, any>[]).map((r) => ({
      partnerType: String(r.partnerType),
      total: n(r.total),
      active: n(r.active),
      onHold: n(r.onHold),
      newThisMonth: n(r.newThisMonth),
    }));

    const sum = (key: 'total' | 'active' | 'onHold' | 'newThisMonth') =>
      typed.reduce((acc, r) => acc + r[key], 0);
    const split = (key: 'total' | 'active' | 'onHold' | 'newThisMonth') =>
      typed
        .map((r) => ({ partnerType: r.partnerType, count: r[key] }))
        .sort((a, b) => a.partnerType.localeCompare(b.partnerType));

    const total = sum('total');
    const active = sum('active');

    return {
      total: { count: total, byType: split('total') },
      active: {
        count: active,
        // Share of the accounts that are live, which is the number the brief
        // asks to see beside it.
        percentOfTotal: total > 0 ? Math.round((active / total) * 100) : 0,
        byType: split('active'),
      },
      newThisMonth: {
        count: sum('newThisMonth'),
        byType: split('newThisMonth'),
      },
      onHold: { count: sum('onHold'), byType: split('onHold') },
    };
  }

  async adminOverview() {
    const [counts] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')  AS "pendingApprovals",
         COUNT(*) FILTER (WHERE status = 'active')   AS "active",
         COUNT(*) FILTER (WHERE status = 'hold')     AS "hold",
         COUNT(*) FILTER (WHERE status = 'disabled') AS "disabled",
         COUNT(*) FILTER (WHERE "partnerType" = 'kol')          AS "kol",
         COUNT(*) FILTER (WHERE "partnerType" = 'distribution') AS "distribution",
         COUNT(*) AS "total"
       FROM partner WHERE "deletedAt" IS NULL`,
    );

    const [queue] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM partner_payout WHERE status = 'pending')          AS "pendingPayouts",
         (SELECT COALESCE(SUM("amountVnd"), 0) FROM partner_payout WHERE status = 'pending')  AS "pendingPayoutVnd",
         (SELECT COUNT(*) FROM partner_deposit_request WHERE status = 'pending') AS "pendingDeposits",
         (SELECT COALESCE(SUM("commissionVnd"), 0) FROM order_partner_commission WHERE status = 'pending') AS "pendingCommissionVnd",
         (SELECT COUNT(*) FROM order_partner_commission WHERE status = 'pending') AS "pendingCommissions"`,
    );

    const [money] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(c."commissionVnd") FILTER (WHERE c."createdAt" >= now() - INTERVAL '30 days'), 0) AS "commission30dVnd",
         COALESCE(SUM(c."commissionVnd"), 0) AS "commissionTotalVnd"
       FROM order_partner_commission c WHERE c.status <> 'reversed'`,
    );

    const [revenue] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(${ORDER_REVENUE_SQL}) FILTER (WHERE o."createdAt" >= now() - INTERVAL '30 days'), 0) AS "revenue30dVnd",
         COUNT(*) FILTER (WHERE o."createdAt" >= now() - INTERVAL '30 days') AS "orders30d"
       FROM "order" o
       WHERE o."attributedPartnerId" IS NOT NULL
         AND o."deletedAt" IS NULL
         AND o.status IN ('paid', 'completed')`,
    );

    const topPartners = await this.dataSource.query(
      `SELECT p.id, p."contactName", p."partnerType", p."tierCode",
              COALESCE(SUM(${ORDER_REVENUE_SQL}), 0) AS "revenue30dVnd",
              COUNT(o.id) AS "orders30d"
       FROM partner p
       JOIN "order" o
         ON o."attributedPartnerId" = p.id
        AND o."deletedAt" IS NULL
        AND o.status IN ('paid', 'completed')
        AND o."createdAt" >= now() - INTERVAL '30 days'
       GROUP BY p.id
       ORDER BY 5 DESC
       LIMIT 5`,
    );

    const n = (v: unknown) => Number(v ?? 0);
    return {
      partners: {
        total: n(counts?.total),
        active: n(counts?.active),
        pendingApprovals: n(counts?.pendingApprovals),
        hold: n(counts?.hold),
        disabled: n(counts?.disabled),
        kol: n(counts?.kol),
        distribution: n(counts?.distribution),
      },
      queue: {
        pendingApprovals: n(counts?.pendingApprovals),
        pendingPayouts: n(queue?.pendingPayouts),
        pendingPayoutVnd: n(queue?.pendingPayoutVnd),
        pendingDeposits: n(queue?.pendingDeposits),
        pendingCommissionVnd: n(queue?.pendingCommissionVnd),
        pendingCommissions: n(queue?.pendingCommissions),
      },
      money: {
        revenue30dVnd: n(revenue?.revenue30dVnd),
        orders30d: n(revenue?.orders30d),
        commission30dVnd: n(money?.commission30dVnd),
        commissionTotalVnd: n(money?.commissionTotalVnd),
      },
      policy: {
        payoutMinVnd: PARTNER_PAYOUT_MIN_VND,
        depositMinVnd: PARTNER_DEPOSIT_MIN_VND,
        depositMaxVnd: PARTNER_DEPOSIT_MAX_VND,
        cardTopupFeePercent: PARTNER_CARD_TOPUP_FEE_PERCENT,
      },
      topPartners: topPartners.map((t: Record<string, any>) => ({
        id: Number(t.id),
        contactName: t.contactName,
        partnerType: t.partnerType,
        tierCode: t.tierCode,
        revenue30dVnd: Number(t.revenue30dVnd ?? 0),
        orders30d: Number(t.orders30d ?? 0),
      })),
    };
  }

  private async getPartnerOrThrowById(id: number): Promise<PartnerEntity> {
    const partner = await this.partnerRepository.findOne({ where: { id } });
    if (!partner) throw new NotFoundException(`Partner ${id} not found`);
    return partner;
  }

  // ───────────────────────── Order attribution (called by OrdersService) ─────────────────────────

  /** Start of the attribution window: visits older than this earn nothing. */
  private attributionWindowStart(now = new Date(), days?: number | null): Date {
    const window = days && days > 0 ? days : PARTNER_LINK_ATTRIBUTION_DAYS;

    return new Date(now.getTime() - window * 24 * 60 * 60 * 1000);
  }

  /**
   * How many days this partner's clicks keep earning them the order (#037).
   *
   * It comes from their tier — a higher tier is credited for longer — and
   * falls back to the programme default for a partner with no tier yet.
   */
  private async attributionDaysFor(partner: {
    partnerType: PartnerTypeEnum;
    tierCode?: string | null;
  }): Promise<number> {
    if (!partner.tierCode) return PARTNER_LINK_ATTRIBUTION_DAYS;

    const tier = await this.tierRepository.findOne({
      where: { partnerType: partner.partnerType, tierCode: partner.tierCode },
    });

    const days = Number(tier?.attributionDays ?? 0);
    return days > 0 ? days : PARTNER_LINK_ATTRIBUTION_DAYS;
  }

  /**
   * Resolves a partner-link code to an active KOL partner for order attribution.
   * Only KOL partners earn commission via links — distribution partners buy at
   * cost through the separate PARTNER_STOCK order flow.
   *
   * An order counts for the partner only within 30 days of the buyer's most
   * recent visit to the link (#095, ý 3). That window used to live entirely in
   * the browser — the `esim_partner_link` cookie's max-age — with the server
   * accepting whatever code the checkout sent, forever; `PARTNER_LINK_ATTRIBUTION_DAYS`
   * sat in `partners.enum.ts` unused. A cookie that outlives its max-age (kept
   * by a profile restore, an unusual client, or hand-set) therefore went on
   * paying commission indefinitely.
   *
   * Two checks now run here, in order of precision:
   *   • `clickedAt`, when the checkout sends the stamp the redirect wrote — the
   *     buyer's own last visit, which is exactly what the rule is about;
   *   • otherwise the link's own newest click. Any honest visit leaves a click
   *     row, so a link with no click in 30 days cannot have an in-window cookie
   *     behind it — this can never reject a buyer who really did visit.
   */
  /**
   * Has this partner already had an order from the same device or network
   * (#036)?
   *
   * One person buying through their own audience's link over and over looks
   * exactly like this. The order still earns — the brief is explicit — but it
   * is marked so an admin can review the partner's other transactions.
   */
  async hasOrderFromSameOrigin(
    partnerId: number,
    visitorId: string | null,
    ipHash: string | null,
  ): Promise<boolean> {
    if (!visitorId && !ipHash) return false;

    const [row] = await this.dataSource.query(
      `SELECT 1
       FROM "order" o
       WHERE o."attributedPartnerId" = $1
         AND o."deletedAt" IS NULL
         AND (
           ($2::text IS NOT NULL AND o."buyerVisitorId" = $2)
           OR ($3::text IS NOT NULL AND o."buyerIpHash" = $3)
         )
       LIMIT 1`,
      [partnerId, visitorId, ipHash],
    );

    return Boolean(row);
  }

  /**
   * Who earns on this order, in one place (#033, #034, #035, #038).
   *
   * In order of strength:
   *  1. a partner's discount code typed at checkout — the most deliberate act,
   *     and the brief hands the order to whoever's code was used (#033). It is
   *     also what rescues the partner when the customer browsed on a laptop and
   *     bought on a phone without signing in (#035).
   *  2. the link cookie on this device, within the attribution window.
   *  3. the attribution stored against the customer's account, which survives a
   *     change of device (#034).
   *
   * An anonymous click on one device and a purchase on another, with no code
   * and no account carrying the attribution, earns nothing — there is nothing
   * connecting the two, and guessing would pay a partner for somebody else's
   * customer (#035).
   */
  async resolveOrderAttribution(params: {
    linkCode?: string | null;
    clickedAt?: string | null;
    clickId?: string | null;
    couponCode?: string | null;
    buyerUserId?: number | null;
    ipHash?: string | null;
    userAgent?: string | null;
  }): Promise<{
    partnerLinkCode: string | null;
    attributedPartnerId: number | null;
    linkId: number | null;
  }> {
    const none = {
      partnerLinkCode: null,
      attributedPartnerId: null,
      linkId: null,
    };

    const couponPartnerId = await this.resolvePartnerForCoupon(
      params.couponCode,
    );
    if (couponPartnerId) {
      return { ...none, attributedPartnerId: couponPartnerId };
    }

    const fromAccount = async () => {
      const bound = await this.resolveMemberAttribution(params.buyerUserId);
      if (bound) {
        return {
          ...none,
          attributedPartnerId: bound.partnerId,
          linkId: bound.linkId,
        };
      }

      // Last resort: the device the click came from (#039).
      const fromDevice = await this.resolveDeviceForAttribution(
        params.ipHash,
        params.userAgent,
      );
      return fromDevice
        ? {
            ...none,
            attributedPartnerId: fromDevice.partnerId,
            linkId: fromDevice.linkId,
          }
        : none;
    };

    // The server-minted click id outranks the cookie: same click, but this one
    // did not have to survive in the browser (#039).
    const fromClick = await this.resolveClickForAttribution(params.clickId);
    if (fromClick) {
      // The click id carries the link, so the account can be bound even when
      // the cookie that used to carry the code is long gone (#034, #039).
      if (params.buyerUserId) {
        void this.saveMemberAttribution(
          params.buyerUserId,
          fromClick.partnerId,
          fromClick.linkId,
        ).catch(() => undefined);
      }
      return {
        partnerLinkCode: params.linkCode ?? null,
        attributedPartnerId: fromClick.partnerId,
        linkId: fromClick.linkId,
      };
    }

    if (!params.linkCode) return fromAccount();

    const parsed = params.clickedAt ? new Date(params.clickedAt) : null;
    const resolved = await this.resolveLinkForAttribution(
      params.linkCode,
      parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
    );
    if (!resolved) return fromAccount();

    // Buying while signed in also binds the attribution to the account, so the
    // customer's next order from any device still finds it (#034).
    if (params.buyerUserId) {
      void this.bindLinkToMember(params.buyerUserId, params.linkCode).catch(
        () => undefined,
      );
    }

    return {
      partnerLinkCode: params.linkCode,
      attributedPartnerId: resolved.partnerId,
      linkId: resolved.linkId,
    };
  }

  /**
   * Remember which partner a signed-in customer arrived through (#034).
   *
   * A cookie only covers the device it was set on. Binding the attribution to
   * the account means somebody who opens the link on a laptop while signed in
   * and buys on their phone still earns the partner their commission. The
   * newest link wins, which is the rule #038 asks for.
   */
  async bindLinkToMember(
    userId: number,
    code: string,
  ): Promise<{ partnerId: number; linkId: number } | null> {
    const resolved = await this.resolveLinkForAttribution(code, new Date());
    if (!resolved) return null;

    await this.saveMemberAttribution(
      userId,
      resolved.partnerId,
      resolved.linkId,
    );

    return resolved;
  }

  /**
   * One row per account, so writing it replaces whatever was there before —
   * that is both "the later link wins" (#038) and the fresh-click restart of
   * the window (#037).
   */
  private async saveMemberAttribution(
    userId: number,
    partnerId: number,
    linkId: number | null,
  ): Promise<void> {
    await this.memberAttributionRepository.save({
      userId,
      partnerId,
      linkId,
      attributedAt: new Date(),
    });
  }

  /**
   * The partner this customer's account is attributed to, if the visit is
   * still inside the attribution window (#034).
   */
  async resolveMemberAttribution(
    userId?: number | null,
  ): Promise<{ partnerId: number; linkId: number | null } | null> {
    if (!userId) return null;

    const row = await this.memberAttributionRepository.findOne({
      where: { userId },
    });
    if (!row) return null;

    // The partner may have been suspended since the click.
    const partner = await this.partnerRepository.findOne({
      where: { id: row.partnerId, status: PartnerStatusEnum.ACTIVE },
    });
    if (!partner || partner.partnerType !== PartnerTypeEnum.KOL) return null;

    const windowStart = this.attributionWindowStart(
      new Date(),
      await this.attributionDaysFor(partner),
    );
    if (new Date(row.attributedAt) < windowStart) return null;

    return { partnerId: row.partnerId, linkId: row.linkId };
  }

  /**
   * The partner behind a discount code the buyer typed in (#033).
   *
   * A code beats a link: the customer may have opened partner A's link days
   * ago, but typing partner B's code at checkout is a deliberate act, and the
   * brief gives the order to B. Only a code that belongs to a partner counts —
   * the house's own codes leave attribution alone.
   */
  async resolvePartnerForCoupon(code?: string | null): Promise<number | null> {
    if (!code?.trim()) return null;

    const coupon = await this.couponRepository.findOne({
      where: { code: code.trim().toUpperCase() },
    });

    if (!coupon?.partnerId) return null;
    if (coupon.isActive === false) return null;

    return coupon.partnerId;
  }

  async resolveLinkForAttribution(
    code: string,
    clickedAt?: Date | null,
  ): Promise<{ partnerId: number; linkId: number } | null> {
    const link = await this.linkRepository.findOne({
      where: { code, status: PartnerLinkStatusEnum.ACTIVE },
    });
    if (!link) return null;

    const partner = await this.partnerRepository.findOne({
      where: { id: link.partnerId, status: PartnerStatusEnum.ACTIVE },
    });
    if (!partner || partner.partnerType !== PartnerTypeEnum.KOL) return null;

    // The window belongs to the partner's tier, and every fresh click restarts
    // it — `visitedAt` below is the newest click we know of (#037).
    const windowStart = this.attributionWindowStart(
      new Date(),
      await this.attributionDaysFor(partner),
    );

    // A stamp from the future is a broken clock (or a hand-edited cookie), not
    // a fresh visit — treat it as no stamp at all and check the click log.
    const visitedAt =
      clickedAt && clickedAt.getTime() <= Date.now() ? clickedAt : null;

    if (visitedAt) {
      if (visitedAt < windowStart) return null;
    } else {
      const lastClick = await this.linkClickRepository.findOne({
        where: { linkId: link.id },
        order: { clickedAt: 'DESC' },
      });
      if (!lastClick || lastClick.clickedAt < windowStart) return null;
    }

    return { partnerId: partner.id, linkId: link.id };
  }

  /**
   * The partner behind a click id the checkout sent back (#039).
   *
   * This is the sturdiest of the three signals: the id was minted by the server
   * at the moment of the click, so the click's own timestamp is read from the
   * log rather than taken from the browser. Nothing here trusts a cookie, which
   * is the whole point — Safari and iOS throw the cookie away long before the
   * window is up.
   */
  async resolveClickForAttribution(
    clickId?: string | null,
  ): Promise<{ partnerId: number; linkId: number } | null> {
    const id = clickId?.trim();
    if (!id) return null;

    const click = await this.linkClickRepository.findOne({
      where: { clickId: id },
    });
    if (!click) return null;

    const link = await this.linkRepository.findOne({
      where: { id: click.linkId, status: PartnerLinkStatusEnum.ACTIVE },
    });
    if (!link) return null;

    const partner = await this.partnerRepository.findOne({
      where: { id: link.partnerId, status: PartnerStatusEnum.ACTIVE },
    });
    if (!partner || partner.partnerType !== PartnerTypeEnum.KOL) return null;

    const windowStart = this.attributionWindowStart(
      new Date(),
      await this.attributionDaysFor(partner),
    );
    if (click.clickedAt < windowStart) return null;

    return { partnerId: partner.id, linkId: link.id };
  }

  // ───────────────────────── Session journey (#040) ─────────────────────────

  /**
   * What a plausible buying session looks like (#040).
   *
   * A person compares a handful of plans before paying; they do not read twenty
   * of them in ten seconds, and they rarely pay for one they never opened. Both
   * numbers are deliberately generous — the point is to mark the obvious cases
   * for review, not to guess at borderline ones.
   */
  private static readonly SESSION_INHUMAN_PLAN_VIEWS = 12;
  private static readonly SESSION_INHUMAN_WINDOW_MS = 10_000;
  /** A visitor cannot file more than this in a day; past it, the rest is noise. */
  private static readonly SESSION_EVENTS_DAILY_CAP = 600;

  /**
   * Record the steps the tracking snippet reported (#040).
   *
   * Anonymous and unauthenticated by nature — it runs before anyone signs in —
   * so it takes only what it can use: a known step name, a visitor id, the
   * click the session came from, and a plan slug for a plan view. Anything else
   * in the payload is dropped rather than stored.
   */
  async recordSessionEvents(payload: {
    visitorId?: string | null;
    clickId?: string | null;
    ipHash?: string | null;
    events: { type?: string | null; ref?: string | null }[];
  }): Promise<{ recorded: number }> {
    const visitorId = payload.visitorId?.trim().slice(0, 64) || null;
    const clickId = payload.clickId?.trim().slice(0, 64) || null;
    // Without one of these the rows could never be read back for a session.
    if (!visitorId && !clickId) return { recorded: 0 };

    const known = new Set<string>(Object.values(SessionEventTypeEnum));
    const events = (payload.events ?? [])
      .slice(0, 20)
      .filter((event): event is { type: string; ref?: string | null } =>
        Boolean(event?.type && known.has(event.type)),
      );
    if (!events.length) return { recorded: 0 };

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const alreadyToday = await this.sessionEventRepository.count({
      where: visitorId
        ? { visitorId, occurredAt: MoreThan(since) }
        : { clickId: clickId as string, occurredAt: MoreThan(since) },
    });
    const room = PartnersService.SESSION_EVENTS_DAILY_CAP - alreadyToday;
    if (room <= 0) return { recorded: 0 };

    const rows = events.slice(0, room).map((event) =>
      this.sessionEventRepository.create({
        visitorId,
        clickId,
        eventType: event.type as SessionEventTypeEnum,
        ref: event.ref?.trim().slice(0, 160) || null,
        ipHash: payload.ipHash?.trim().slice(0, 64) || null,
      }),
    );
    await this.sessionEventRepository.save(rows);

    return { recorded: rows.length };
  }

  /**
   * What this session's steps say about it (#040).
   *
   * Returns `null` when there is nothing to judge — no visitor id and no click
   * id, which is every order placed before the snippet had a chance to run.
   * A verdict is a mark for an admin, never a refusal.
   */
  async evaluateSessionShape(params: {
    visitorId?: string | null;
    clickId?: string | null;
  }): Promise<SessionShapeEnum | null> {
    const visitorId = params.visitorId?.trim() || null;
    const clickId = params.clickId?.trim() || null;
    if (!visitorId && !clickId) return null;

    // The session, not the lifetime: a day is far longer than any checkout.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await this.sessionEventRepository.find({
      where: visitorId
        ? { visitorId, occurredAt: MoreThan(since) }
        : { clickId: clickId as string, occurredAt: MoreThan(since) },
      order: { occurredAt: 'ASC' },
      take: 500,
    });

    // Nothing at all: either a scripted order, or a browser that blocked the
    // snippet. Both are worth a look and neither is worth refusing.
    if (!events.length) return SessionShapeEnum.NO_BROWSING;

    const planViews = events.filter(
      (event) => event.eventType === SessionEventTypeEnum.PLAN_VIEW,
    );
    for (
      let i = PartnersService.SESSION_INHUMAN_PLAN_VIEWS - 1;
      i < planViews.length;
      i += 1
    ) {
      const span =
        planViews[i].occurredAt.getTime() -
        planViews[
          i - (PartnersService.SESSION_INHUMAN_PLAN_VIEWS - 1)
        ].occurredAt.getTime();
      if (span <= PartnersService.SESSION_INHUMAN_WINDOW_MS) {
        return SessionShapeEnum.INHUMAN_SPEED;
      }
    }

    const looked = events.some(
      (event) =>
        event.eventType === SessionEventTypeEnum.PLAN_VIEW ||
        event.eventType === SessionEventTypeEnum.PLAN_LIST,
    );
    return looked ? SessionShapeEnum.NATURAL : SessionShapeEnum.NO_BROWSING;
  }

  /**
   * The partner behind the last click from this device (#039).
   *
   * The weakest of the signals and the last one consulted: it says only that
   * somebody on this network, in this browser, opened the partner's link inside
   * the window. That is still a great deal better than losing the attribution
   * because an in-app browser stripped the query string and iOS had already
   * dropped the cookie — and an order that reaches this path is marked as
   * coming from a shared origin anyway (#036).
   */
  async resolveDeviceForAttribution(
    ipHash?: string | null,
    userAgent?: string | null,
  ): Promise<{ partnerId: number; linkId: number } | null> {
    const deviceHash = partnerDeviceFingerprint(ipHash, userAgent);
    if (!deviceHash) return null;

    const click = await this.linkClickRepository.findOne({
      where: { deviceHash },
      order: { clickedAt: 'DESC' },
    });
    if (!click) return null;

    const link = await this.linkRepository.findOne({
      where: { id: click.linkId, status: PartnerLinkStatusEnum.ACTIVE },
    });
    if (!link) return null;

    const partner = await this.partnerRepository.findOne({
      where: { id: link.partnerId, status: PartnerStatusEnum.ACTIVE },
    });
    if (!partner || partner.partnerType !== PartnerTypeEnum.KOL) return null;

    const windowStart = this.attributionWindowStart(
      new Date(),
      await this.attributionDaysFor(partner),
    );
    if (click.clickedAt < windowStart) return null;

    return { partnerId: partner.id, linkId: link.id };
  }

  /**
   * Create a PENDING commission snapshot at order-creation time, mirroring
   * OrderReferralEntity's lifecycle. Called from OrdersService when an order
   * carries `attributedPartnerId`.
   *
   * A partner buying through their own link earns nothing (#095): the brief
   * asks for exactly this — "tránh trường hợp tạo xong link giới thiệu rồi tự
   * đặt hàng kiếm hoa hồng". Nothing stopped it before, so a partner could
   * discount every one of their own orders by their own commission rate.
   *
   * The order keeps its attribution: hiding it would make the partner's own
   * order list disagree with what they actually did. It is simply marked as
   * earning nothing, with the reason shown.
   */
  /**
   * Whether this order is the partner referring themselves (#041).
   *
   * Setting up a link and then buying through it is the oldest way to turn a
   * commission into a discount, and changing the email on the order is the
   * oldest way around a check on the account alone. So every detail the partner
   * registered with is compared: the account, the contact email and phone, the
   * tax code on the order's invoice, and — for somebody running a second
   * partner account — the bank account the commission would be paid into.
   *
   * Returns the detail that matched, or null. Never throws: a lookup that fails
   * must not stop an order, and the caller treats "no match" as "pay them".
   */
  async detectSelfReferral(
    partner: PartnerEntity,
    order: { orderId: number; buyerUserId?: number | null },
  ): Promise<CommissionRejectionReasonEnum | null> {
    if (partner.userId && partner.userId === order.buyerUserId) {
      return CommissionRejectionReasonEnum.SELF_ACCOUNT;
    }

    try {
      if (order.buyerUserId) {
        const buyer = await this.userRepository.findOne({
          where: { id: order.buyerUserId },
        });

        if (
          buyer &&
          sameEmail(buyer.email, partner.contactEmail) &&
          // The partner's own account is the case above; this is a second
          // account opened on the same address.
          buyer.id !== partner.userId
        ) {
          return CommissionRejectionReasonEnum.SELF_EMAIL;
        }
        if (buyer && samePhone(buyer.phoneNumber, partner.contactPhone)) {
          return CommissionRejectionReasonEnum.SELF_PHONE;
        }

        // A partner buying through a second partner account of their own: the
        // payout details are what give it away.
        const buyerPartner = await this.partnerRepository.findOne({
          where: { userId: order.buyerUserId },
        });
        if (buyerPartner && buyerPartner.id !== partner.id) {
          if (sameEmail(buyerPartner.contactEmail, partner.contactEmail)) {
            return CommissionRejectionReasonEnum.SELF_EMAIL;
          }
          if (samePhone(buyerPartner.contactPhone, partner.contactPhone)) {
            return CommissionRejectionReasonEnum.SELF_PHONE;
          }
          if (sameDigits(buyerPartner.taxCode, partner.taxCode)) {
            return CommissionRejectionReasonEnum.SELF_TAX_CODE;
          }
          if (
            sameDigits(
              buyerPartner.bankAccountNumber,
              partner.bankAccountNumber,
            )
          ) {
            return CommissionRejectionReasonEnum.SELF_BANK_ACCOUNT;
          }
        }
      }

      // The invoice is where a company buyer's tax code lands.
      if (partner.taxCode) {
        const [invoice] = await this.dataSource.query(
          `SELECT "taxCode" FROM invoice WHERE "orderId" = $1 LIMIT 1`,
          [order.orderId],
        );
        if (invoice && sameDigits(invoice.taxCode, partner.taxCode)) {
          return CommissionRejectionReasonEnum.SELF_TAX_CODE;
        }
      }
    } catch (error) {
      // Never at the cost of the order: an unreadable lookup means we simply
      // do not know, and not knowing is not a reason to withhold a commission.
      this.logger.warn(
        `Order ${order.orderId}: self-referral check failed — ${String(error)}`,
      );
    }

    return null;
  }

  async createPendingCommissionForOrder(params: {
    orderId: number;
    partnerId: number;
    linkId: number | null;
    orderValueVnd: number;
    /** The account that placed the order, when there is one. */
    buyerUserId?: number | null;
    /** `TOPUP` orders earn no commission (#025). */
    orderType?: string | null;
  }): Promise<OrderPartnerCommissionEntity | null> {
    const partner = await this.partnerRepository.findOne({
      where: { id: params.partnerId },
    });
    if (!partner) return null;

    // Topping up an existing eSIM earns nothing (#025): the partner brought
    // the customer once, and every later top-up of that same eSIM is not a new
    // referral.
    if (params.orderType === TOPUP_ORDER_TYPE) return null;

    // A partner buying through their own link, under any of the details they
    // registered with (#041, #095). Recorded rather than dropped, so the reason
    // is there when they ask why.
    const selfReferral = await this.detectSelfReferral(partner, {
      orderId: params.orderId,
      buyerUserId: params.buyerUserId,
    });
    if (selfReferral) {
      this.logger.warn(
        `Order ${params.orderId}: no commission for partner ${partner.id} — self-referral (${selfReferral}).`,
      );
      return this.commissionRepository.save(
        this.commissionRepository.create({
          orderId: params.orderId,
          partnerId: params.partnerId,
          linkId: params.linkId,
          commissionVnd: 0,
          tierSnapshot: partner.tierCode ?? null,
          status: OrderPartnerCommissionStatusEnum.REJECTED,
          rejectionReason: selfReferral,
        }),
      );
    }

    const tier = partner.tierCode
      ? await this.tierRepository.findOne({
          where: {
            partnerType: partner.partnerType,
            tierCode: partner.tierCode,
          },
        })
      : null;
    const commissionPercent = Number(tier?.commissionPercent ?? 0);
    if (commissionPercent <= 0) {
      // Approving a partner does not assign a tier, and the rate lives on the
      // tier — so an approved-but-untiered partner earns zero on every order
      // with nothing anywhere to say why (#095). At least leave a trace.
      this.logger.warn(
        `Order ${params.orderId}: partner ${partner.id} earns no commission ` +
          `(tier: ${partner.tierCode ?? 'none'}, rate: ${commissionPercent}%).`,
      );
      return null;
    }

    const commissionVnd = Math.round(
      (params.orderValueVnd * commissionPercent) / 100,
    );
    if (commissionVnd <= 0) return null;

    return this.commissionRepository.save(
      this.commissionRepository.create({
        orderId: params.orderId,
        partnerId: params.partnerId,
        linkId: params.linkId,
        commissionVnd,
        tierSnapshot: partner.tierCode ?? null,
        // The rate as it stood when the order was placed (#042). Worked out
        // here and stored, so a later tier change — or an edit to the tier's
        // own percentage — cannot reach back and alter this order.
        commissionPercentSnapshot: commissionPercent,
        status: OrderPartnerCommissionStatusEnum.PENDING,
      }),
    );
  }

  /**
   * Credit a PENDING commission to the partner's wallet (#019).
   *
   * Not at the moment of payment: an affiliate order stays "Chờ xác nhận" for
   * 24 hours from when it was placed, because that is the window in which a
   * customer cancels or asks for a refund. Crediting straight away meant a
   * partner could see the money, request a withdrawal, and only then have the
   * order fall over.
   *
   * Called both from the payment hook — which credits immediately when the
   * order is already older than the hold, e.g. a bank transfer that landed two
   * days later — and from the hourly sweep for everything else.
   */
  async creditCommissionForOrder(orderId: number): Promise<void> {
    const commission = await this.commissionRepository.findOne({
      where: { orderId },
    });
    if (
      !commission ||
      commission.status !== OrderPartnerCommissionStatusEnum.PENDING
    ) {
      return;
    }

    const [order] = await this.dataSource.query(
      `SELECT "createdAt" FROM "order" WHERE id = $1`,
      [orderId],
    );
    const placedAt = order?.createdAt ? new Date(order.createdAt) : null;
    if (
      placedAt &&
      Date.now() - placedAt.getTime() < COMMISSION_HOLD_HOURS * 3600_000
    ) {
      // Still inside the 24h window; the sweep will pick it up.
      return;
    }

    const transaction = await this.createWalletTransaction(
      commission.partnerId,
      PartnerWalletTransactionTypeEnum.COMMISSION_EARNED,
      Number(commission.commissionVnd),
      {
        orderId,
        sourceType: 'order_partner_commission',
        sourceId: String(commission.id),
        idempotencyKey: `partner_commission:${orderId}`,
        reason: 'Hoa hồng đơn hàng qua link tiếp thị',
      },
    );

    commission.status = OrderPartnerCommissionStatusEnum.CREDITED;
    commission.rewardTransactionId = transaction.id;
    await this.commissionRepository.save(commission);

    if (commission.linkId) {
      await this.linkRepository.increment(
        { id: commission.linkId },
        'conversionCount',
        1,
      );
      await this.linkRepository.increment(
        { id: commission.linkId },
        'totalCommissionVnd',
        Number(commission.commissionVnd),
      );
    }
  }

  /**
   * Take a commission back when its order dies (#007).
   *
   * PENDING commission → REVERSED, nothing moved yet. A commission already
   * CREDITED, on a fully refunded or cancelled order, is clawed back with a
   * negative wallet transaction — and the wallet is allowed to go below zero
   * on purpose: if the partner has already withdrawn the money, the debt has
   * to sit there and be netted off the next period's commission, which is
   * exactly what the brief asks for. Withdrawals are blocked meanwhile because
   * the available balance floors at zero.
   *
   * Partial refunds are left CREDITED for manual review — proportional
   * reversal is #018; log instead of silently mis-crediting.
   */
  async reverseCommissionForOrder(
    orderId: number,
    opts: { fullRefund?: boolean; cancelled?: boolean } = {},
  ): Promise<void> {
    const commission = await this.commissionRepository.findOne({
      where: { orderId },
    });
    if (!commission) return;

    if (commission.status === OrderPartnerCommissionStatusEnum.PENDING) {
      commission.status = OrderPartnerCommissionStatusEnum.REVERSED;
      await this.commissionRepository.save(commission);
      return;
    }

    if (
      commission.status === OrderPartnerCommissionStatusEnum.CREDITED &&
      (opts.fullRefund || opts.cancelled)
    ) {
      const transaction = await this.createWalletTransaction(
        commission.partnerId,
        PartnerWalletTransactionTypeEnum.COMMISSION_REVERSED,
        -Number(commission.commissionVnd),
        {
          orderId,
          sourceType: 'order_partner_commission_reversal',
          sourceId: String(commission.id),
          idempotencyKey: `partner_commission_reversal:${orderId}`,
          reason: opts.cancelled
            ? 'Hoàn hoa hồng do đơn hàng bị hủy'
            : 'Hoàn hoa hồng do đơn hàng được hoàn tiền toàn phần',
        },
      );
      commission.status = OrderPartnerCommissionStatusEnum.REVERSED;
      commission.reversedTransactionId = transaction.id;
      await this.commissionRepository.save(commission);

      // The link's running totals were raised when this commission was
      // credited; leaving them alone would show a partner commission on a link
      // that no longer earned it (#016).
      if (commission.linkId) {
        await this.linkRepository.decrement(
          { id: commission.linkId },
          'conversionCount',
          1,
        );
        await this.linkRepository.decrement(
          { id: commission.linkId },
          'totalCommissionVnd',
          Number(commission.commissionVnd),
        );
      }
    } else if (
      commission.status === OrderPartnerCommissionStatusEnum.CREDITED
    ) {
      this.logger.warn(
        `reverseCommissionForOrder: partial refund on order ${orderId} reached the full-reversal path — commission ${commission.id} left CREDITED. Use adjustCommissionForPartialRefund.`,
      );
    }
  }

  /**
   * Take back the share of a commission that belongs to refunded products
   * (#018).
   *
   * An affiliate order carries several eSIMs; refunding one of them used to
   * leave the whole commission standing, so the partner kept earning on a
   * product the customer no longer has. The share is proportional to the money
   * actually refunded, and `reversedCommissionVnd` records what has already
   * been taken so a second refund on the same order charges only the
   * difference rather than the whole share again.
   *
   * `commissionVnd` itself is reduced, which is what keeps every total that
   * sums it — the dashboard, the link's running totals, the payout ledger —
   * correct without each of them having to know about refunds.
   */
  async adjustCommissionForPartialRefund(params: {
    orderId: number;
    refundedAmountVnd: number;
    orderValueVnd: number;
  }): Promise<void> {
    const { orderId, refundedAmountVnd, orderValueVnd } = params;
    if (orderValueVnd <= 0 || refundedAmountVnd <= 0) return;

    const commission = await this.commissionRepository.findOne({
      where: { orderId },
    });
    if (
      !commission ||
      commission.status === OrderPartnerCommissionStatusEnum.REVERSED
    ) {
      return;
    }

    const alreadyReversed = Number(commission.reversedCommissionVnd ?? 0);
    const earned = Number(commission.commissionVnd) + alreadyReversed;
    const target = Math.min(
      earned,
      Math.round((earned * refundedAmountVnd) / orderValueVnd),
    );
    const delta = target - alreadyReversed;
    if (delta <= 0) return;

    if (commission.status === OrderPartnerCommissionStatusEnum.CREDITED) {
      // The money is in the partner's wallet, so it has to come back out —
      // into a negative balance if they have already withdrawn it (#007).
      await this.createWalletTransaction(
        commission.partnerId,
        PartnerWalletTransactionTypeEnum.COMMISSION_REVERSED,
        -delta,
        {
          orderId,
          sourceType: 'order_partner_commission_partial_reversal',
          sourceId: String(commission.id),
          idempotencyKey: `partner_commission_partial_reversal:${orderId}:${target}`,
          reason: 'Điều chỉnh hoa hồng do hoàn tiền một phần đơn hàng',
        },
      );

      if (commission.linkId) {
        await this.linkRepository.decrement(
          { id: commission.linkId },
          'totalCommissionVnd',
          delta,
        );
      }
    }

    commission.commissionVnd = earned - target;
    commission.reversedCommissionVnd = target;
    if (commission.commissionVnd <= 0) {
      commission.status = OrderPartnerCommissionStatusEnum.REVERSED;
      // A fully refunded order stops counting as a conversion for the link.
      if (
        commission.linkId &&
        commission.status === OrderPartnerCommissionStatusEnum.REVERSED
      ) {
        await this.linkRepository.decrement(
          { id: commission.linkId },
          'conversionCount',
          1,
        );
      }
    }
    await this.commissionRepository.save(commission);
  }

  // ───────────────────────── Internal helpers ─────────────────────────

  private async getOrCreateWallet(
    partnerId: number,
  ): Promise<PartnerWalletEntity> {
    return this.dataSource.transaction((manager) =>
      this.getOrCreateWalletWithManager(partnerId, manager),
    );
  }

  private async getOrCreateWalletWithManager(
    partnerId: number,
    manager: EntityManager,
  ): Promise<PartnerWalletEntity> {
    const walletRepo = manager.getRepository(PartnerWalletEntity);
    let wallet = await walletRepo.findOne({ where: { partnerId } });
    if (!wallet) {
      wallet = await walletRepo.save(
        walletRepo.create({
          partnerId,
          balanceVnd: 0,
          status: PartnerWalletStatusEnum.ACTIVE,
        }),
      );
    }
    return wallet;
  }

  private async createWalletTransaction(
    partnerId: number,
    type: PartnerWalletTransactionTypeEnum,
    amountVnd: number,
    input: WalletTransactionInput,
  ): Promise<PartnerWalletTransactionEntity> {
    return this.dataSource.transaction((manager) =>
      this.createWalletTransactionWithManager(
        partnerId,
        type,
        amountVnd,
        input,
        manager,
      ),
    );
  }

  private async createWalletTransactionWithManager(
    partnerId: number,
    type: PartnerWalletTransactionTypeEnum,
    amountVnd: number,
    input: WalletTransactionInput,
    manager: EntityManager,
  ): Promise<PartnerWalletTransactionEntity> {
    const amount = Math.round(Number(amountVnd));
    if (amount === 0) {
      throw new BadRequestException(
        'Partner wallet transaction amount cannot be 0',
      );
    }

    const transactionRepo = manager.getRepository(
      PartnerWalletTransactionEntity,
    );
    if (input.idempotencyKey) {
      const existing = await transactionRepo.findOne({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const wallet = await this.getOrCreateWalletWithManager(partnerId, manager);
    const balanceAfterVnd = Number(wallet.balanceVnd) + amount;
    wallet.balanceVnd = balanceAfterVnd;
    await manager.getRepository(PartnerWalletEntity).save(wallet);

    return transactionRepo.save(
      transactionRepo.create({
        walletId: wallet.id,
        partnerId,
        type,
        amountVnd: amount,
        balanceAfterVnd,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        orderId: input.orderId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      }),
    );
  }

  private generateLinkCode(): string {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }
}
