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
  PARTNER_DEPOSIT_MIN_VND,
  PARTNER_PAYOUT_MIN_VND,
} from './partners.constants';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { In, DataSource, EntityManager, Repository } from 'typeorm';
import { AllConfigType } from '../config/config.type';
import { MailService } from '../mail/mail.service';
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
import { PartnerApplyDto } from './dto/partner-apply.dto';
import { UpdatePartnerProfileDto } from './dto/update-partner-profile.dto';
import {
  QueryPartnerDto,
  QueryPartnerCommissionDto,
} from './dto/query-partner.dto';
import {
  AdjustPartnerWalletDto,
  AssignPartnerTierDto,
  CreateDepositRequestDto,
  CreatePartnerPayoutDto,
  RejectPartnerDto,
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
  OrderPartnerCommissionStatusEnum,
  PartnerDepositRequestStatusEnum,
  PartnerLinkStatusEnum,
  PartnerPayoutStatusEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
  PartnerWalletStatusEnum,
  PartnerWalletTransactionTypeEnum,
  PARTNER_LINK_ATTRIBUTION_DAYS,
} from './partners.enum';

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
  revenue30dVnd: number;
  lastActivityAt: Date | null;
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
  tierSnapshot: string | null;
  createdAt: Date;
}
/** Order states that will never pay a commission, however they got here. */
const DEAD_ORDER_STATUSES = new Set(['cancelled', 'failed', 'refunded']);

/** Order states where the money has actually arrived. */
const SETTLED_ORDER_STATUSES = new Set(['paid', 'completed']);

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
  if (isSelfReferral) {
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
    private readonly mailService: MailService,
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
      ...(dto.bankName !== undefined && { bankName: dto.bankName }),
      ...(dto.bankAccountNumber !== undefined && {
        bankAccountNumber: dto.bankAccountNumber,
      }),
      ...(dto.bankAccountHolder !== undefined && {
        bankAccountHolder: dto.bankAccountHolder,
      }),
      ...(dto.bankBranch !== undefined && { bankBranch: dto.bankBranch }),
    });
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
        // Lifetime paid out, so the partner can reconcile against their bank.
        this.payoutRepository
          .createQueryBuilder('payout')
          .select('COALESCE(SUM(payout.amountVnd), 0)', 'sum')
          .where('payout.partnerId = :partnerId', { partnerId })
          .andWhere('payout.status = :status', {
            status: PartnerPayoutStatusEnum.PAID,
          })
          .getRawOne<{ sum: string }>(),
      ],
    );

    const balanceVnd = Number(wallet.balanceVnd);
    const pendingPayoutVnd = Number(pendingPayouts?.sum ?? 0);

    return {
      balanceVnd,
      availableBalanceVnd: Math.max(0, balanceVnd - pendingPayoutVnd),
      pendingPayoutVnd,
      /** Commission earned but still awaiting reconciliation. */
      pendingCommissionVnd: Number(pendingCommissions?.sum ?? 0),
      /** Lifetime total actually paid out. */
      withdrawnVnd: Number(paidPayouts?.sum ?? 0),
      status: wallet.status,
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

  async createDepositRequest(partnerId: number, dto: CreateDepositRequestDto) {
    const sepay = this.configService.get('sepay', { infer: true });
    if (!sepay?.accountNumber) {
      throw new BadRequestException(
        'Chưa cấu hình tài khoản nhận chuyển khoản (SEPAY_ACCOUNT_NUMBER).',
      );
    }

    const bankTransferCode = generateBankTransferCode();
    const request = await this.depositRequestRepository.save(
      this.depositRequestRepository.create({
        partnerId,
        amountVnd: Math.round(dto.amountVnd),
        bankTransferCode,
        status: PartnerDepositRequestStatusEnum.PENDING,
      }),
    );

    const qrUrl = buildVietQrUrl({
      bankCode: sepay.bankCode,
      accountNumber: sepay.accountNumber,
      accountName: sepay.accountName,
      amountVnd: request.amountVnd,
      transferCode: bankTransferCode,
    });

    return {
      id: request.id,
      amountVnd: request.amountVnd,
      bankTransferCode,
      qrUrl,
      accountNumber: sepay.accountNumber,
      accountName: sepay.accountName,
      bankCode: sepay.bankCode,
      status: request.status,
    };
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
    if (!partner || partner.partnerType !== PartnerTypeEnum.KOL) {
      throw new ForbiddenException(
        'Chỉ đối tác KOL mới có thể tạo link tiếp thị.',
      );
    }

    // A partner may name their own code — "được tạo link/mã giới thiệu tối
    // thiểu 6 ký tự tùy ý" (#095). A memorable code is the whole point when it
    // has to be read aloud in a video, so a taken one is reported as such
    // instead of being silently swapped for a random string.
    if (dto.code) {
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
        tierSnapshot: row.tierSnapshot ?? null,
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
    if (query.search) {
      qb.andWhere(
        '(partner.contactName ILIKE :search OR partner.contactEmail ILIKE :search OR partner.companyName ILIKE :search)',
        { search: `%${query.search}%` },
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
      `(SELECT COALESCE(SUM(o."vndPrice"), 0) FROM "order" o
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
    if (partner.status !== PartnerStatusEnum.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể duyệt đối tác đang ở trạng thái chờ duyệt.',
      );
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      partner.status = PartnerStatusEnum.ACTIVE;
      partner.approvedAt = new Date();
      partner.approvedByAdminId = adminId;
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

  async updateStatus(
    id: number,
    dto: UpdatePartnerStatusDto,
  ): Promise<PartnerEntity> {
    const partner = await this.adminFindById(id);
    partner.status = dto.status;
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
    partner.tierCode = dto.tierCode;
    return this.partnerRepository.save(partner);
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
    const transaction = await this.createWalletTransaction(
      request.partnerId,
      PartnerWalletTransactionTypeEnum.DEPOSIT,
      request.amountVnd,
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
  ): Promise<{ targetPath: string | null } | null> {
    const link = await this.linkRepository.findOne({
      where: { code, status: PartnerLinkStatusEnum.ACTIVE },
    });
    if (!link) return null;

    await this.linkClickRepository.save(
      this.linkClickRepository.create({
        linkId: link.id,
        ipHash: meta.ipHash ?? null,
        userAgent: meta.userAgent ?? null,
        referrer: meta.referrer ?? null,
        visitorId: meta.visitorId ?? null,
      }),
    );
    await this.linkRepository.increment({ id: link.id }, 'clickCount', 1);

    return { targetPath: link.targetPath ?? null };
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
              o."vndPrice",
              o."createdAt",
              c."commissionVnd",
              c.status AS "commissionStatus",
              l.code   AS "linkCode",
              COALESCE(
                json_agg(
                  json_build_object('planName', p.name, 'quantity', oi.quantity)
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'
              ) AS items,
              (
                SELECT count(*)::int FROM esim e
                JOIN order_item oi2 ON oi2.id = e."orderItemId"
                WHERE oi2."orderId" = o.id
              ) AS "esimCount",
              -- The partner buying through their own link (#095).
              (o."userId" IS NOT NULL AND o."userId" = pa."userId") AS "isSelfReferral"
       FROM "order" o
       JOIN partner pa ON pa.id = o."attributedPartnerId"
       LEFT JOIN order_item oi ON oi."orderId" = o.id
       LEFT JOIN plan p ON p.id = oi."planId"
       LEFT JOIN order_partner_commission c ON c."orderId" = o.id
       LEFT JOIN partner_link l ON l.id = c."linkId"
       WHERE o."attributedPartnerId" = $1 AND o."deletedAt" IS NULL
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

      return {
        orderNumber: r.orderNumber,
        status: r.status,
        vndPrice: Number(r.vndPrice ?? 0),
        createdAt: r.createdAt,
        commissionVnd,
        commissionStatus,
        linkCode: r.linkCode ?? null,
        esimCount: Number(r.esimCount ?? 0),
        items: r.items ?? [],
        validity,
        invalidReason,
      };
    });
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
          `SELECT COALESCE(SUM(o."vndPrice"), 0) AS "revenueVnd",
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
  async getMySummary(partnerId: number) {
    const partner = await this.getPartnerOrThrowById(partnerId);

    const [perf] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(o."vndPrice") FILTER (WHERE o."createdAt" >= now() - INTERVAL '30 days'), 0) AS "revenue30",
         COUNT(*)          FILTER (WHERE o."createdAt" >= now() - INTERVAL '30 days') AS "orders30",
         COALESCE(SUM(o."vndPrice"), 0) AS "revenueTotal",
         COUNT(*) AS "ordersTotal"
       FROM "order" o
       WHERE o."attributedPartnerId" = $1
         AND o."deletedAt" IS NULL
         AND o.status IN ('paid', 'completed')`,
      [partnerId],
    );

    const [comm] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(c."commissionVnd") FILTER (WHERE c."createdAt" >= now() - INTERVAL '30 days'), 0) AS "commission30",
         COALESCE(SUM(c."commissionVnd"), 0) AS "commissionTotal",
         COALESCE(SUM(c."commissionVnd") FILTER (WHERE c.status = 'pending'), 0) AS "commissionPending"
       FROM order_partner_commission c
       WHERE c."partnerId" = $1 AND c.status <> 'reversed'`,
      [partnerId],
    );

    const [clicks] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE k."clickedAt" >= now() - INTERVAL '30 days') AS "clicks30",
         COUNT(*) AS "clicksTotal"
       FROM partner_link_click k
       JOIN partner_link l ON l.id = k."linkId"
       WHERE l."partnerId" = $1`,
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
      performance30d: {
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
      commissionPendingVnd: Number(comm?.commissionPending ?? 0),
      wallet,
      tier: {
        current: currentTier,
        next: nextTier,
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
                SELECT SUM(o."vndPrice") FROM "order" o
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
              ) AS "lastOrderAt"
       FROM partner p
       LEFT JOIN partner_wallet w ON w."partnerId" = p.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (
                  WHERE o.status IN ('paid', 'completed')
                ) AS "totalOrders",
                COALESCE(SUM(o."vndPrice") FILTER (
                  WHERE o.status IN ('paid', 'completed')
                ), 0) AS "totalRevenueVnd",
                COALESCE(SUM(o."vndPrice" - COALESCE(o."vndCostPrice", 0)) FILTER (
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
        revenue30dVnd: Number(m?.revenue30dVnd ?? 0),
        lastActivityAt: m?.lastOrderAt ?? null,
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
         COALESCE(SUM(o."vndPrice") FILTER (WHERE o."createdAt" >= now() - INTERVAL '30 days'), 0) AS "revenue30dVnd",
         COUNT(*) FILTER (WHERE o."createdAt" >= now() - INTERVAL '30 days') AS "orders30d"
       FROM "order" o
       WHERE o."attributedPartnerId" IS NOT NULL
         AND o."deletedAt" IS NULL
         AND o.status IN ('paid', 'completed')`,
    );

    const topPartners = await this.dataSource.query(
      `SELECT p.id, p."contactName", p."partnerType", p."tierCode",
              COALESCE(SUM(o."vndPrice"), 0) AS "revenue30dVnd",
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
  private attributionWindowStart(now = new Date()): Date {
    return new Date(
      now.getTime() - PARTNER_LINK_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000,
    );
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

    const windowStart = this.attributionWindowStart();

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
  async createPendingCommissionForOrder(params: {
    orderId: number;
    partnerId: number;
    linkId: number | null;
    orderValueVnd: number;
    /** The account that placed the order, when there is one. */
    buyerUserId?: number | null;
  }): Promise<OrderPartnerCommissionEntity | null> {
    const partner = await this.partnerRepository.findOne({
      where: { id: params.partnerId },
    });
    if (!partner) return null;

    if (params.buyerUserId && partner.userId === params.buyerUserId) {
      this.logger.warn(
        `Order ${params.orderId}: no commission, partner ${partner.id} bought through their own link.`,
      );
      return null;
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
        status: OrderPartnerCommissionStatusEnum.PENDING,
      }),
    );
  }

  /**
   * Credit a PENDING commission to the partner's wallet once the order is
   * paid. Mirrors WalletsService.completePaidOrderBenefits' referral block.
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
   * Reverse a commission when its order is cancelled before payment (PENDING
   * → REVERSED) or fully refunded after being credited (CREDITED → REVERSED,
   * with a matching negative wallet transaction). Partial refunds are left
   * uncredited-back for manual review — proportional reversal for a second
   * currency (partner wallet) on top of the buyer-side proportional reversal
   * is deferred; log instead of silently mis-crediting.
   */
  async reverseCommissionForOrder(
    orderId: number,
    opts: { fullRefund?: boolean } = {},
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
      opts.fullRefund
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
          reason: 'Hoàn hoa hồng do đơn hàng được hoàn tiền toàn phần',
        },
      );
      commission.status = OrderPartnerCommissionStatusEnum.REVERSED;
      commission.reversedTransactionId = transaction.id;
      await this.commissionRepository.save(commission);
    } else if (
      commission.status === OrderPartnerCommissionStatusEnum.CREDITED
    ) {
      this.logger.warn(
        `reverseCommissionForOrder: partial refund on order ${orderId} — commission ${commission.id} left CREDITED (no proportional reversal in v1).`,
      );
    }
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
