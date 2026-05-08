import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import { Order } from '../orders/domain/order';
import { OrderEntity } from '../orders/infrastructure/persistence/relational/entities/order.entity';
import { RefundOrderDto } from './dto/admin-wallet.dto';
import {
  ReferralProfileDto,
  WalletMeDto,
  WalletTransactionDto,
} from './dto/wallet-response.dto';
import { OrderReferralEntity } from './infrastructure/persistence/relational/entities/order-referral.entity';
import { OrderRefundEntity } from './infrastructure/persistence/relational/entities/order-refund.entity';
import { UserReferralProfileEntity } from './infrastructure/persistence/relational/entities/user-referral-profile.entity';
import { UserWalletEntity } from './infrastructure/persistence/relational/entities/user-wallet.entity';
import { WalletHoldEntity } from './infrastructure/persistence/relational/entities/wallet-hold.entity';
import { WalletTransactionEntity } from './infrastructure/persistence/relational/entities/wallet-transaction.entity';
import {
  EXU_EXPIRY_DAYS,
  OrderReferralStatusEnum,
  OrderRefundModeEnum,
  OrderRefundStatusEnum,
  REFERRAL_DISCOUNT_VND,
  REFERRAL_MIN_ORDER_VND,
  REFERRAL_REWARD_VND,
  WalletHoldStatusEnum,
  WalletStatusEnum,
  WalletTransactionTypeEnum,
} from './wallets.enum';

const HOLD_MINUTES = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReferralValidationResult = {
  referralCode: string;
  referrerUserId: number;
  buyerDiscountVnd: number;
  rewardVnd: number;
};

type WalletTransactionInput = {
  sourceType?: string | null;
  sourceId?: string | null;
  orderId?: number | null;
  refUserId?: number | null;
  idempotencyKey?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdByAdminId?: number | null;
};

@Injectable()
export class WalletsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserWalletEntity)
    private readonly walletRepository: Repository<UserWalletEntity>,
    @InjectRepository(WalletTransactionEntity)
    private readonly transactionRepository: Repository<WalletTransactionEntity>,
    @InjectRepository(WalletHoldEntity)
    private readonly holdRepository: Repository<WalletHoldEntity>,
    @InjectRepository(UserReferralProfileEntity)
    private readonly referralProfileRepository: Repository<UserReferralProfileEntity>,
    @InjectRepository(OrderReferralEntity)
    private readonly orderReferralRepository: Repository<OrderReferralEntity>,
    @InjectRepository(OrderRefundEntity)
    private readonly orderRefundRepository: Repository<OrderRefundEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  async getWalletSummary(userId: number): Promise<WalletMeDto> {
    const wallet = await this.getOrCreateWallet(userId);
    const availableBalanceVnd = await this.getAvailableBalance(userId);
    const expiresAt = wallet.expiresAt;
    const daysLeft = expiresAt
      ? Math.max(
          0,
          Math.ceil((expiresAt.getTime() - Date.now()) / MILLISECONDS_PER_DAY),
        )
      : null;

    return {
      balanceVnd: Number(wallet.balanceVnd),
      availableBalanceVnd,
      status: wallet.status,
      expiresAt,
      daysLeft,
    };
  }

  async getTransactions(
    userId: number,
    limit = 50,
  ): Promise<WalletTransactionDto[]> {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const entities = await this.transactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take,
    });

    return entities.map((entity) => ({
      id: entity.id,
      userId: entity.userId,
      type: entity.type,
      amountVnd: Number(entity.amountVnd),
      balanceAfterVnd: Number(entity.balanceAfterVnd),
      orderId: entity.orderId,
      reason: entity.reason,
      createdAt: entity.createdAt,
    }));
  }

  async listWallets(): Promise<UserWalletEntity[]> {
    return this.walletRepository.find({ order: { updatedAt: 'DESC' } });
  }

  async getWalletForAdmin(userId: number): Promise<WalletMeDto> {
    return this.getWalletSummary(userId);
  }

  async getReferralProfile(userId: number): Promise<ReferralProfileDto> {
    const profile = await this.getOrCreateReferralProfile(userId);
    return {
      userId: profile.userId,
      code: profile.code,
      isActive: profile.isActive,
    };
  }

  async validateReferralForOrder(
    userId: number,
    referralCode: string,
    subtotalVndPrice: number,
    hasCoupon: boolean,
  ): Promise<ReferralValidationResult> {
    if (hasCoupon) {
      throw new BadRequestException(
        'Mã giới thiệu không được áp dụng đồng thời với mã giảm giá khác.',
      );
    }

    if (subtotalVndPrice < REFERRAL_MIN_ORDER_VND) {
      throw new BadRequestException(
        'Mã giảm giá này không áp dụng cho đơn hàng có tổng giá trị dưới 100.000đ.',
      );
    }

    const code = referralCode.trim().toUpperCase();
    const profile = await this.referralProfileRepository.findOne({
      where: { code, isActive: true },
    });
    if (!profile) {
      throw new NotFoundException('Referral code not found');
    }

    if (profile.userId === userId) {
      throw new BadRequestException(
        'Bạn không thể sử dụng mã giới thiệu của chính mình.',
      );
    }

    const paidOrders = await this.orderRepository.count({
      where: { userId, status: 'paid' },
    });
    if (paidOrders > 0) {
      throw new BadRequestException(
        'Mã giới thiệu chỉ áp dụng cho đơn hàng đầu tiên.',
      );
    }

    const referralBenefits = await this.orderReferralRepository.count({
      where: { refereeUserId: userId },
    });
    if (referralBenefits > 0) {
      throw new BadRequestException('Bạn đã sử dụng mã giới thiệu trước đó.');
    }

    return {
      referralCode: code,
      referrerUserId: profile.userId,
      buyerDiscountVnd: REFERRAL_DISCOUNT_VND,
      rewardVnd: REFERRAL_REWARD_VND,
    };
  }

  async createOrderReferral(
    orderId: number,
    refereeUserId: number,
    referral: ReferralValidationResult,
  ): Promise<OrderReferralEntity> {
    const existing = await this.orderReferralRepository.findOne({
      where: { orderId },
    });
    if (existing) return existing;

    return this.orderReferralRepository.save(
      this.orderReferralRepository.create({
        orderId,
        referrerUserId: referral.referrerUserId,
        refereeUserId,
        referralCode: referral.referralCode,
        buyerDiscountVnd: referral.buyerDiscountVnd,
        rewardVnd: referral.rewardVnd,
        status: OrderReferralStatusEnum.PENDING,
      }),
    );
  }

  async createHold(
    orderId: number,
    userId: number,
    amountVnd: number,
  ): Promise<WalletHoldEntity | null> {
    const amount = Math.round(Number(amountVnd));
    if (amount <= 0) return null;

    return this.dataSource.transaction(async (manager) => {
      const holdRepo = manager.getRepository(WalletHoldEntity);
      const existing = await holdRepo.findOne({ where: { orderId } });
      if (existing) return existing;

      const wallet = await this.getOrCreateWalletWithManager(userId, manager);
      if (wallet.status !== WalletStatusEnum.ACTIVE) {
        throw new BadRequestException('Ví eXu đang bị khóa.');
      }

      const availableBalance = await this.getAvailableBalanceWithManager(
        userId,
        manager,
      );
      if (amount > availableBalance) {
        throw new BadRequestException('Số dư eXu không đủ.');
      }

      return holdRepo.save(
        holdRepo.create({
          walletId: wallet.id,
          userId,
          orderId,
          amountVnd: amount,
          status: WalletHoldStatusEnum.HELD,
          expiresAt: this.addMinutes(new Date(), HOLD_MINUTES),
        }),
      );
    });
  }

  async captureHoldForOrder(
    orderId: number,
  ): Promise<WalletTransactionEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const holdRepo = manager.getRepository(WalletHoldEntity);
      const hold = await holdRepo.findOne({ where: { orderId } });
      if (!hold) return null;
      if (hold.status === WalletHoldStatusEnum.CAPTURED) return null;
      if (hold.status !== WalletHoldStatusEnum.HELD) return null;

      const transaction = await this.createTransactionWithManager(
        hold.userId,
        WalletTransactionTypeEnum.REDEMPTION_CAPTURE,
        -Number(hold.amountVnd),
        {
          orderId,
          sourceType: 'order',
          sourceId: String(orderId),
          idempotencyKey: `redemption_capture:${orderId}`,
          reason: 'Use eXu for order payment',
        },
        manager,
      );

      hold.status = WalletHoldStatusEnum.CAPTURED;
      await holdRepo.save(hold);
      return transaction;
    });
  }

  async releaseHoldForOrder(orderId: number): Promise<void> {
    const hold = await this.holdRepository.findOne({ where: { orderId } });
    if (!hold || hold.status !== WalletHoldStatusEnum.HELD) return;
    hold.status = WalletHoldStatusEnum.RELEASED;
    await this.holdRepository.save(hold);
  }

  async completePaidOrderBenefits(order: Order): Promise<void> {
    if (order.walletSpentVndAmount > 0) {
      await this.captureHoldForOrder(order.id);
    }

    if (order.cashbackAmountVnd > 0 && !order.cashbackTransactionId) {
      const transaction = await this.createTransaction(
        order.userId,
        WalletTransactionTypeEnum.ORDER_CASHBACK,
        order.cashbackAmountVnd,
        {
          orderId: order.id,
          sourceType: 'order',
          sourceId: String(order.id),
          idempotencyKey: `order_cashback:${order.id}`,
          reason: '2% eXu cashback for paid order',
        },
      );
      await this.orderRepository.update(order.id, {
        cashbackTransactionId: transaction.id,
      });
    }

    const referral = await this.orderReferralRepository.findOne({
      where: { orderId: order.id },
    });
    if (
      referral &&
      referral.status === OrderReferralStatusEnum.PENDING &&
      !referral.rewardTransactionId
    ) {
      const transaction = await this.createTransaction(
        referral.referrerUserId,
        WalletTransactionTypeEnum.REFERRAL_REWARD,
        Number(referral.rewardVnd),
        {
          orderId: order.id,
          refUserId: referral.refereeUserId,
          sourceType: 'order_referral',
          sourceId: String(referral.id),
          idempotencyKey: `referral_reward:${order.id}`,
          reason: 'Referral reward for successful first order',
        },
      );
      referral.rewardTransactionId = transaction.id;
      referral.status = OrderReferralStatusEnum.CREDITED;
      await this.orderReferralRepository.save(referral);
    }
  }

  async adminAdjustWallet(
    userId: number,
    amountVnd: number,
    reason: string | null,
    adminId: number,
  ): Promise<WalletTransactionEntity> {
    const amount = Math.round(Number(amountVnd));
    if (amount === 0) {
      throw new BadRequestException('amountVnd must be different from 0');
    }

    return this.createTransaction(
      userId,
      amount > 0
        ? WalletTransactionTypeEnum.MANUAL_CREDIT
        : WalletTransactionTypeEnum.MANUAL_DEBIT,
      amount,
      {
        sourceType: 'admin',
        sourceId: String(adminId),
        reason,
        createdByAdminId: adminId,
      },
    );
  }

  async cancelWalletBalance(
    userId: number,
    reason: string | null,
    adminId: number,
  ): Promise<WalletTransactionEntity | null> {
    const wallet = await this.getOrCreateWallet(userId);
    const balance = Number(wallet.balanceVnd);
    if (balance === 0) return null;

    return this.createTransaction(
      userId,
      WalletTransactionTypeEnum.MANUAL_CANCEL,
      -balance,
      {
        sourceType: 'admin',
        sourceId: String(adminId),
        reason,
        createdByAdminId: adminId,
      },
    );
  }

  async updateWalletStatus(
    userId: number,
    status: WalletStatusEnum,
  ): Promise<UserWalletEntity> {
    const wallet = await this.getOrCreateWallet(userId);
    wallet.status = status;
    return this.walletRepository.save(wallet);
  }

  async refundOrder(
    order: Order,
    dto: RefundOrderDto,
    adminId: number,
  ): Promise<OrderRefundEntity> {
    if (!['paid', 'refunded'].includes(order.status)) {
      throw new BadRequestException('Only paid orders can be refunded');
    }

    const amount = Math.round(Number(dto.amountVnd));
    if (amount < 0) {
      throw new BadRequestException(
        'Refund amount must be greater than or equal to 0',
      );
    }

    if (amount > Number(order.vndPrice)) {
      throw new BadRequestException(
        'Refund amount cannot exceed the paid VND amount',
      );
    }

    const refund = await this.orderRefundRepository.save(
      this.orderRefundRepository.create({
        orderId: order.id,
        userId: order.userId,
        mode: dto.mode,
        amountVnd: amount,
        status: OrderRefundStatusEnum.COMPLETED,
        reason: dto.reason ?? null,
        adminNote: dto.adminNote ?? null,
        walletTransactionId: null,
        createdByAdminId: adminId,
      }),
    );

    if (order.cashbackAmountVnd > 0 && !order.cashbackReversedAt) {
      await this.createTransaction(
        order.userId,
        WalletTransactionTypeEnum.ORDER_CASHBACK_REVERSAL,
        -Number(order.cashbackAmountVnd),
        {
          orderId: order.id,
          sourceType: 'order',
          sourceId: String(order.id),
          idempotencyKey: `order_cashback_reversal:${order.id}`,
          reason: 'Reverse order cashback after refund',
          createdByAdminId: adminId,
        },
      );
      await this.orderRepository.update(order.id, {
        cashbackReversedAt: new Date(),
      });
    }

    const referral = await this.orderReferralRepository.findOne({
      where: { orderId: order.id },
    });
    if (
      referral &&
      referral.status === OrderReferralStatusEnum.CREDITED &&
      !referral.reversedTransactionId
    ) {
      const reverseTransaction = await this.createTransaction(
        referral.referrerUserId,
        WalletTransactionTypeEnum.REFERRAL_REWARD_REVERSAL,
        -Number(referral.rewardVnd),
        {
          orderId: order.id,
          refUserId: referral.refereeUserId,
          sourceType: 'order_referral',
          sourceId: String(referral.id),
          idempotencyKey: `referral_reward_reversal:${order.id}`,
          reason: 'Reverse referral reward after refund',
          createdByAdminId: adminId,
        },
      );
      referral.reversedTransactionId = reverseTransaction.id;
      referral.status = OrderReferralStatusEnum.REVERSED;
      await this.orderReferralRepository.save(referral);
    } else if (
      referral &&
      referral.status === OrderReferralStatusEnum.PENDING
    ) {
      referral.status = OrderReferralStatusEnum.REVERSED;
      await this.orderReferralRepository.save(referral);
    }

    if (dto.mode === OrderRefundModeEnum.WALLET && amount > 0) {
      const walletTransaction = await this.createTransaction(
        order.userId,
        WalletTransactionTypeEnum.REFUND_TO_WALLET,
        amount,
        {
          orderId: order.id,
          sourceType: 'order_refund',
          sourceId: String(refund.id),
          idempotencyKey: `refund_to_wallet:${refund.id}`,
          reason: dto.reason ?? 'Refund to eXu wallet',
          createdByAdminId: adminId,
        },
      );
      refund.walletTransactionId = walletTransaction.id;
      await this.orderRefundRepository.save(refund);
    }

    const refundedAmountVnd = Number(order.refundedAmountVnd ?? 0) + amount;
    await this.orderRepository.update(order.id, {
      status: 'refunded',
      refundStatus: OrderRefundStatusEnum.COMPLETED,
      refundedAmountVnd,
    });

    return refund;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireWallets(): Promise<void> {
    const wallets = await this.walletRepository.find({
      where: {
        status: WalletStatusEnum.ACTIVE,
        expiresAt: LessThan(new Date()),
      },
    });

    for (const wallet of wallets) {
      const balance = Number(wallet.balanceVnd);
      if (balance <= 0) continue;
      await this.createTransaction(
        wallet.userId,
        WalletTransactionTypeEnum.EXPIRY_DEBIT,
        -balance,
        {
          sourceType: 'expiry',
          sourceId: wallet.expiresAt?.toISOString() ?? String(wallet.id),
          idempotencyKey: `wallet_expiry:${wallet.id}:${wallet.expiresAt?.toISOString() ?? 'unknown'}`,
          reason: 'eXu expired after 365 days',
        },
      );
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireHolds(): Promise<void> {
    await this.holdRepository.update(
      {
        status: WalletHoldStatusEnum.HELD,
        expiresAt: LessThan(new Date()),
      },
      { status: WalletHoldStatusEnum.EXPIRED },
    );
  }

  private async getOrCreateWallet(userId: number): Promise<UserWalletEntity> {
    return this.dataSource.transaction((manager) =>
      this.getOrCreateWalletWithManager(userId, manager),
    );
  }

  private async getOrCreateWalletWithManager(
    userId: number,
    manager: EntityManager,
  ): Promise<UserWalletEntity> {
    const walletRepo = manager.getRepository(UserWalletEntity);
    let wallet = await walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      wallet = await walletRepo.save(
        walletRepo.create({
          userId,
          balanceVnd: 0,
          status: WalletStatusEnum.ACTIVE,
          expiresAt: null,
        }),
      );
    }
    return wallet;
  }

  private async getOrCreateReferralProfile(
    userId: number,
  ): Promise<UserReferralProfileEntity> {
    let profile = await this.referralProfileRepository.findOne({
      where: { userId },
    });
    if (profile) return profile;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateReferralCode(userId);
      try {
        profile = await this.referralProfileRepository.save(
          this.referralProfileRepository.create({
            userId,
            code,
            isActive: true,
          }),
        );
        return profile;
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }

    throw new BadRequestException('Could not generate referral code');
  }

  private async getAvailableBalance(userId: number): Promise<number> {
    return this.dataSource.transaction((manager) =>
      this.getAvailableBalanceWithManager(userId, manager),
    );
  }

  private async getAvailableBalanceWithManager(
    userId: number,
    manager: EntityManager,
  ): Promise<number> {
    const wallet = await this.getOrCreateWalletWithManager(userId, manager);
    if (wallet.status !== WalletStatusEnum.ACTIVE) return 0;
    if (wallet.expiresAt && wallet.expiresAt.getTime() < Date.now()) return 0;

    const activeHolds = await manager
      .getRepository(WalletHoldEntity)
      .createQueryBuilder('hold')
      .select('COALESCE(SUM(hold.amountVnd), 0)', 'sum')
      .where('hold.userId = :userId', { userId })
      .andWhere('hold.status = :status', { status: WalletHoldStatusEnum.HELD })
      .andWhere('hold.expiresAt > :now', { now: new Date() })
      .getRawOne<{ sum: string }>();

    return Math.max(
      0,
      Number(wallet.balanceVnd) - Number(activeHolds?.sum ?? 0),
    );
  }

  private async createTransaction(
    userId: number,
    type: WalletTransactionTypeEnum,
    amountVnd: number,
    input: WalletTransactionInput,
  ): Promise<WalletTransactionEntity> {
    return this.dataSource.transaction((manager) =>
      this.createTransactionWithManager(
        userId,
        type,
        amountVnd,
        input,
        manager,
      ),
    );
  }

  private async createTransactionWithManager(
    userId: number,
    type: WalletTransactionTypeEnum,
    amountVnd: number,
    input: WalletTransactionInput,
    manager: EntityManager,
  ): Promise<WalletTransactionEntity> {
    const amount = Math.round(Number(amountVnd));
    if (amount === 0) {
      throw new BadRequestException('Wallet transaction amount cannot be 0');
    }

    const transactionRepo = manager.getRepository(WalletTransactionEntity);
    if (input.idempotencyKey) {
      const existing = await transactionRepo.findOne({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const wallet = await this.getOrCreateWalletWithManager(userId, manager);
    const balanceAfterVnd = Number(wallet.balanceVnd) + amount;
    wallet.balanceVnd = balanceAfterVnd;
    if (this.shouldResetExpiry(type, amount)) {
      wallet.expiresAt = this.addDays(new Date(), EXU_EXPIRY_DAYS);
    }
    await manager.getRepository(UserWalletEntity).save(wallet);

    return transactionRepo.save(
      transactionRepo.create({
        walletId: wallet.id,
        userId,
        type,
        amountVnd: amount,
        balanceAfterVnd,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        orderId: input.orderId ?? null,
        refUserId: input.refUserId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      }),
    );
  }

  private shouldResetExpiry(
    type: WalletTransactionTypeEnum,
    amountVnd: number,
  ): boolean {
    if (amountVnd <= 0) return false;
    return [
      WalletTransactionTypeEnum.ORDER_CASHBACK,
      WalletTransactionTypeEnum.REFERRAL_REWARD,
      WalletTransactionTypeEnum.REFUND_TO_WALLET,
      WalletTransactionTypeEnum.MANUAL_CREDIT,
    ].includes(type);
  }

  private generateReferralCode(userId: number): string {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `EXU${userId}${random}`.slice(0, 20);
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }
}
