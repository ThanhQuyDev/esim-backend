import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SubmitOrderDto } from './dto/submit-order.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterOrderDto, SortOrderDto } from './dto/query-order.dto';
import { OrderRepository } from './infrastructure/persistence/order.repository';
import { Order } from './domain/order';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { PlansService } from '../plans/plans.service';
import { OrderItemsService } from '../order-items/order-items.service';
import { AiraloService } from '../esim-providers/airalo/airalo.service';
import { EsimAccessService } from '../esim-providers/esimaccess/esimaccess.service';
import { GadgetKoreaService } from '../esim-providers/gadgetkorea/gadgetkorea.service';
import { AllConfigType } from '../config/config.type';
import { CouponsService } from '../coupons/coupons.service';
import { EsimsService } from '../esims/esims.service';
import { UserOrderDetailDto } from './dto/user-order-detail.dto';
import { AdminOrderDetailDto } from './dto/admin-order-detail.dto';
import { CartsService } from '../carts/carts.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { Plan } from '../plans/domain/plan';
import { WalletsService } from '../wallets/wallets.service';
import type { ReferralValidationResult } from '../wallets/wallets.service';
import { EXU_CASHBACK_PERCENT } from '../wallets/wallets.enum';
import { RefundOrderDto } from '../wallets/dto/admin-wallet.dto';

const VND_ROUNDING_UNIT = 1000;

function roundVndToThousands(amount: number): number {
  return Math.round(amount / VND_ROUNDING_UNIT) * VND_ROUNDING_UNIT;
}

function getDiscountedVndPrice(plan: Plan): number {
  const vndPrice = plan.vndPrice ?? 0;
  if (!plan.discount || plan.discount <= 0) return vndPrice;
  return roundVndToThousands(vndPrice * (1 - plan.discount / 100));
}

type OrderPlanDetail = SubmitOrderDto['items'][number] & { plan: Plan };

type OrderPricing = {
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode: string | null;
  subtotalVndPrice: number;
  couponDiscountVndAmount: number;
  referralCode: string | null;
  referrerUserId: number | null;
  referralDiscountVndAmount: number;
  walletSpentVndAmount: number;
  payableVndPrice: number;
  cashbackAmountVnd: number;
  referral?: ReferralValidationResult;
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly plansService: PlansService,
    private readonly orderItemsService: OrderItemsService,
    private readonly airaloService: AiraloService,
    private readonly esimAccessService: EsimAccessService,
    private readonly gadgetKoreaService: GadgetKoreaService,
    private readonly configService: ConfigService<AllConfigType>,
    @Inject(forwardRef(() => CouponsService))
    private readonly couponsService: CouponsService,
    private readonly esimsService: EsimsService,
    private readonly cartsService: CartsService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
  ) {}

  create(createOrderDto: CreateOrderDto): Promise<Order> {
    return this.orderRepository.create({
      userId: createOrderDto.userId,
      orderNumber: createOrderDto.orderNumber,
      status: createOrderDto.status ?? 'pending',
      totalAmount: createOrderDto.totalAmount,
      currency: createOrderDto.currency,
      paymentMethod: createOrderDto.paymentMethod,
      paymentId: createOrderDto.paymentId,
      couponCode: null,
      discountAmount: 0,
      vndPrice: 0,
      vndCostPrice: 0,
      subtotalVndPrice: 0,
      couponDiscountVndAmount: 0,
      referralCode: null,
      referrerUserId: null,
      referralDiscountVndAmount: 0,
      walletSpentVndAmount: 0,
      payableVndPrice: 0,
      cashbackAmountVnd: 0,
      cashbackTransactionId: null,
      cashbackReversedAt: null,
      refundStatus: null,
      refundedAmountVnd: 0,
    });
  }

  async submitOrder(userId: number, dto: SubmitOrderDto): Promise<Order> {
    // 1. Resolve all plans and validate
    const planDetails = await Promise.all(
      dto.items.map(async (item) => {
        const plan = await this.plansService.findById(item.planId);
        if (!plan) {
          throw new NotFoundException(`Plan ${item.planId} not found`);
        }
        return { ...item, plan };
      }),
    );

    const pricing = await this.calculateOrderPricing(userId, dto, planDetails);

    // 3. Create order
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const order = await this.orderRepository.create({
      userId,
      orderNumber,
      status: 'pending',
      totalAmount: pricing.finalAmount,
      currency: dto.currency,
      paymentMethod: dto.paymentMethod ?? null,
      paymentId: dto.paymentId ?? null,
      couponCode: pricing.couponCode,
      discountAmount: pricing.discountAmount,
      vndPrice: pricing.payableVndPrice,
      vndCostPrice: 0,
      subtotalVndPrice: pricing.subtotalVndPrice,
      couponDiscountVndAmount: pricing.couponDiscountVndAmount,
      referralCode: pricing.referralCode,
      referrerUserId: pricing.referrerUserId,
      referralDiscountVndAmount: pricing.referralDiscountVndAmount,
      walletSpentVndAmount: pricing.walletSpentVndAmount,
      payableVndPrice: pricing.payableVndPrice,
      cashbackAmountVnd: pricing.cashbackAmountVnd,
      cashbackTransactionId: null,
      cashbackReversedAt: null,
      refundStatus: null,
      refundedAmountVnd: 0,
    });

    if (pricing.referral) {
      await this.walletsService.createOrderReferral(
        order.id,
        userId,
        pricing.referral,
      );
    }

    if (pricing.walletSpentVndAmount > 0) {
      await this.walletsService.createHold(
        order.id,
        userId,
        pricing.walletSpentVndAmount,
      );
    }

    // 4. Group items by provider
    const airaloItems = planDetails.filter((i) => i.plan.provider === 'airalo');
    const esimAccessItems = planDetails.filter(
      (i) => i.plan.provider === 'esimaccess',
    );
    const gadgetKoreaItems = planDetails.filter(
      (i) => i.plan.provider === 'gadgetkorea',
    );
    const localItems = planDetails.filter((i) => i.plan.isLocalInventory);

    // 5. Call Airalo API — one call per plan
    for (const item of airaloItems) {
      let orderRequestId: string | null = null;
      try {
        const backendDomain = this.configService.getOrThrow(
          'app.backendDomain',
          { infer: true },
        );
        const webhookUrl = `${backendDomain}/api/v1/webhooks/airalo`;
        this.logger.log(`Airalo webhook URL: ${webhookUrl}`);

        const result = await this.airaloService.submitOrderAsync({
          packageId: item.plan.providerPlanId,
          quantity: item.quantity,
          type: 'sim',
          webhookUrl,
        });
        orderRequestId = result.request_id ?? null;
      } catch (err) {
        this.logger.error(
          `Airalo order failed for plan ${item.planId}: ${(err as Error).message}`,
        );
      }

      await this.orderItemsService.create({
        orderId: order.id,
        planId: item.planId,
        orderRequestId,
        status: 'pending',
        price: item.plan.price,
        currency: dto.currency,
        quantity: item.quantity,
      });
    }

    // 6. Call EsimAccess API — one call for all esimaccess items
    if (esimAccessItems.length > 0) {
      const totalEsimAccessAmount = esimAccessItems.reduce(
        (sum, i) => sum + i.plan.costPrice * i.quantity,
        0,
      );
      const txnId = `${orderNumber}-esimaccess`;

      let esimAccessOrderNo: string | null = null;
      try {
        const result = await this.esimAccessService.submitOrder({
          transactionId: txnId,
          amount: Math.round(totalEsimAccessAmount * 10000),
          packageInfoList: esimAccessItems.map((i) => ({
            packageCode: i.plan.providerPlanId,
            count: i.quantity,
            price: Math.round(i.plan.costPrice * 10000),
            periodNum: i.periodNum,
          })),
        });
        esimAccessOrderNo = result.orderNo ?? null;
      } catch (err) {
        this.logger.error(`EsimAccess order failed: ${(err as Error).message}`);
      }

      for (const item of esimAccessItems) {
        await this.orderItemsService.create({
          orderId: order.id,
          planId: item.planId,
          orderRequestId: esimAccessOrderNo,
          status: 'pending',
          price: item.plan.price,
          currency: dto.currency,
          quantity: item.quantity,
          periodNum: item.periodNum ?? null,
        });
      }
    }

    // 7. Call Gadget Korea API — one call for all gadgetkorea items
    if (gadgetKoreaItems.length > 0) {
      const gkOrderId = `${orderNumber}-gk`;
      // Map optionId -> topupId after response
      const topupIdMap = new Map<string, string>();
      try {
        const result = await this.gadgetKoreaService.submitOrder({
          orderId: gkOrderId,
          products: gadgetKoreaItems.map((i) => ({
            optionId: i.plan.providerPlanId.toLowerCase(),
            qty: i.quantity,
          })),
        });
        // result.products: [{ topupId, optionId }]
        for (const p of result.products ?? []) {
          if (p.topupId && p.optionId) {
            topupIdMap.set(p.optionId.toLowerCase(), p.topupId);
          }
        }
      } catch (err) {
        this.logger.error(
          `Gadget Korea order failed: ${(err as Error).message}`,
        );
      }

      for (const item of gadgetKoreaItems) {
        const topupId =
          topupIdMap.get(item.plan.providerPlanId.toLowerCase()) ?? null;
        await this.orderItemsService.create({
          orderId: order.id,
          planId: item.planId,
          orderRequestId: topupId,
          status: 'pending',
          price: item.plan.price,
          currency: dto.currency,
          quantity: item.quantity,
        });
      }
    }

    // 8. Local providers (esimvn) — assign available esims from inventory
    const localOrderItemIds: number[] = [];
    for (const item of localItems) {
      const orderItem = await this.orderItemsService.create({
        orderId: order.id,
        planId: item.planId,
        orderRequestId: null,
        status: 'pending',
        price: item.plan.price,
        currency: dto.currency,
        quantity: item.quantity,
      });

      try {
        const availableEsims = await this.esimsService.findAvailableByPlanId(
          item.planId,
          item.quantity,
        );

        if (availableEsims.length < item.quantity) {
          this.logger.warn(
            `Not enough local esims for plan ${item.planId}: need ${item.quantity}, found ${availableEsims.length}`,
          );
        }

        for (const esim of availableEsims) {
          await this.esimsService.update(esim.id, {
            orderItemId: orderItem.id,
            userId,
            status: 'assigned',
          });
        }

        if (availableEsims.length >= item.quantity) {
          await this.orderItemsService.update(orderItem.id, {
            status: 'completed',
          });
          localOrderItemIds.push(orderItem.id);
        }
      } catch (err) {
        this.logger.error(
          `Local esim assignment failed for plan ${item.planId}: ${(err as Error).message}`,
        );
      }
    }

    // Increment coupon usage after order created
    if (pricing.couponCode) {
      await this.couponsService.applyCoupon(pricing.couponCode);
    }

    await this.cartsService.clearCart(userId);

    // Send esim purchase email for local items
    await this.sendEsimPurchaseEmails(
      userId,
      orderNumber,
      localOrderItemIds,
      localItems,
    );

    return order;
  }

  async createPendingOrder(
    userId: number,
    dto: SubmitOrderDto,
    orderNumber: string,
    vndRate?: number,
  ): Promise<Order> {
    const planDetails = await Promise.all(
      dto.items.map(async (item) => {
        const plan = await this.plansService.findById(item.planId);
        if (!plan) {
          throw new NotFoundException(`Plan ${item.planId} not found`);
        }
        return { ...item, plan };
      }),
    );

    const pricing = await this.calculateOrderPricing(userId, dto, planDetails);

    const totalVndCostPrice = vndRate
      ? planDetails.reduce(
          (sum, item) =>
            sum + Math.round(item.plan.costPrice * vndRate) * item.quantity,
          0,
        )
      : 0;

    const order = await this.orderRepository.create({
      userId,
      orderNumber,
      status: 'pending',
      totalAmount: pricing.finalAmount,
      currency: dto.currency,
      paymentMethod: null,
      paymentId: null,
      couponCode: pricing.couponCode,
      discountAmount: pricing.discountAmount,
      vndPrice: pricing.payableVndPrice,
      vndCostPrice: totalVndCostPrice,
      subtotalVndPrice: pricing.subtotalVndPrice,
      couponDiscountVndAmount: pricing.couponDiscountVndAmount,
      referralCode: pricing.referralCode,
      referrerUserId: pricing.referrerUserId,
      referralDiscountVndAmount: pricing.referralDiscountVndAmount,
      walletSpentVndAmount: pricing.walletSpentVndAmount,
      payableVndPrice: pricing.payableVndPrice,
      cashbackAmountVnd: pricing.cashbackAmountVnd,
      cashbackTransactionId: null,
      cashbackReversedAt: null,
      refundStatus: null,
      refundedAmountVnd: 0,
    });

    if (pricing.referral) {
      await this.walletsService.createOrderReferral(
        order.id,
        userId,
        pricing.referral,
      );
    }

    if (pricing.walletSpentVndAmount > 0) {
      await this.walletsService.createHold(
        order.id,
        userId,
        pricing.walletSpentVndAmount,
      );
    }

    for (const item of planDetails) {
      const itemVndCostPrice = vndRate
        ? Math.round(item.plan.costPrice * vndRate) * item.quantity
        : 0;

      await this.orderItemsService.create({
        orderId: order.id,
        planId: item.planId,
        orderRequestId: null,
        status: 'pending',
        price: item.plan.price,
        currency: dto.currency,
        quantity: item.quantity,
        vndPrice: getDiscountedVndPrice(item.plan) * item.quantity,
        vndCostPrice: itemVndCostPrice,
        periodNum: item.periodNum ?? null,
      });
    }

    return order;
  }

  private async calculateOrderPricing(
    userId: number,
    dto: SubmitOrderDto,
    planDetails: OrderPlanDetail[],
  ): Promise<OrderPricing> {
    const totalAmount = planDetails.reduce(
      (sum, item) => sum + item.plan.price * item.quantity,
      0,
    );
    const subtotalVndPrice = planDetails.reduce(
      (sum, item) => sum + getDiscountedVndPrice(item.plan) * item.quantity,
      0,
    );

    let discountAmount = 0;
    let couponCode: string | null = null;
    let couponDiscountVndAmount = 0;
    let referral: ReferralValidationResult | undefined;
    let referralCode: string | null = null;
    let referrerUserId: number | null = null;
    let referralDiscountVndAmount = 0;

    if (dto.couponCode && dto.referralCode) {
      throw new BadRequestException(
        'Mã giới thiệu không được áp dụng đồng thời với mã giảm giá khác.',
      );
    }

    if (dto.referralCode) {
      referral = await this.walletsService.validateReferralForOrder(
        userId,
        dto.referralCode,
        subtotalVndPrice,
        Boolean(dto.couponCode),
      );
      referralCode = referral.referralCode;
      referrerUserId = referral.referrerUserId;
      referralDiscountVndAmount = referral.buyerDiscountVnd;
    }

    if (dto.couponCode) {
      const couponResult = await this.couponsService.validateCoupon(
        { code: dto.couponCode, orderAmount: subtotalVndPrice },
        userId,
      );
      couponCode = dto.couponCode.toUpperCase();
      couponDiscountVndAmount = roundVndToThousands(
        couponResult.discountAmount,
      );
      // Derive USD discount from the same percentage
      const discountPercent = couponResult.discountPercent / 100;
      discountAmount = Math.round(totalAmount * discountPercent * 100) / 100;
    }

    const finalAmount = Math.round((totalAmount - discountAmount) * 100) / 100;
    const afterCouponAndReferral = Math.max(
      0,
      subtotalVndPrice - couponDiscountVndAmount - referralDiscountVndAmount,
    );
    const requestedWalletAmount = Math.max(
      0,
      Math.round(Number(dto.useWalletAmountVnd ?? 0)),
    );
    const walletSpentVndAmount = Math.min(
      requestedWalletAmount,
      afterCouponAndReferral,
    );
    const payableVndPrice = Math.max(
      0,
      afterCouponAndReferral - walletSpentVndAmount,
    );
    const cashbackAmountVnd = Math.round(
      (payableVndPrice * EXU_CASHBACK_PERCENT) / 100,
    );

    return {
      totalAmount,
      discountAmount,
      finalAmount,
      couponCode,
      subtotalVndPrice,
      couponDiscountVndAmount,
      referralCode,
      referrerUserId,
      referralDiscountVndAmount,
      walletSpentVndAmount,
      payableVndPrice,
      cashbackAmountVnd,
      referral,
    };
  }

  async findByOrderNumber(orderNumber: string): Promise<NullableType<Order>> {
    return this.orderRepository.findByOrderNumber(orderNumber);
  }

  async findByOrderNumberAndUserId(
    orderNumber: string,
    userId: number,
  ): Promise<UserOrderDetailDto | null> {
    const order = await this.orderRepository.findByOrderNumberAndUserId(
      orderNumber,
      userId,
    );
    if (!order) return null;

    const orderItems = await this.orderItemsService.findByOrderId(order.id);
    const [esims, plans] = await Promise.all([
      this.esimsService.findByOrderItemIds(orderItems.map((i) => i.id)),
      Promise.all(orderItems.map((i) => this.plansService.findById(i.planId))),
    ]);

    const esimsByOrderItemId = new Map<number, typeof esims>();
    for (const esim of esims) {
      if (esim.orderItemId == null) continue;
      const list = esimsByOrderItemId.get(esim.orderItemId) ?? [];
      list.push(esim);
      esimsByOrderItemId.set(esim.orderItemId, list);
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      vndPrice: order.vndPrice,
      paymentMethod: order.paymentMethod,
      couponCode: order.couponCode,
      createdAt: order.createdAt,
      items: orderItems.map((item, idx) => {
        const plan = plans[idx];
        return {
          id: item.id,
          planId: item.planId,
          plan: plan
            ? {
                id: plan.id,
                name: plan.name,
                slug: plan.slug,
                durationDays: plan.durationDays,
                dataMb: plan.dataMb,
                price: plan.price,
                vndPrice: plan.vndPrice,
                currency: plan.currency,
                speed: plan.speed,
                operatorName: plan.operatorName,
                countryCode: plan.countryCode,
              }
            : null,
          orderRequestId: item.orderRequestId,
          status: item.status,
          vndPrice: item.vndPrice,
          quantity: item.quantity,
          esims: esimsByOrderItemId.get(item.id) ?? [],
        };
      }),
    };
  }

  async submitProviders(orderId: number): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const orderItems = await this.orderItemsService.findByOrderId(orderId);

    const itemsWithPlans = await Promise.all(
      orderItems.map(async (oi) => {
        const plan = await this.plansService.findById(oi.planId);
        if (!plan) throw new NotFoundException(`Plan ${oi.planId} not found`);
        return { ...oi, plan };
      }),
    );

    const airaloItems = itemsWithPlans.filter(
      (i) => i.plan.provider === 'airalo',
    );
    const esimAccessItems = itemsWithPlans.filter(
      (i) => i.plan.provider === 'esimaccess',
    );
    const gadgetKoreaItems = itemsWithPlans.filter(
      (i) => i.plan.provider === 'gadgetkorea',
    );
    const localItems = itemsWithPlans.filter((i) => i.plan.isLocalInventory);

    for (const item of airaloItems) {
      try {
        const backendDomain = this.configService.getOrThrow(
          'app.backendDomain',
          { infer: true },
        );
        const webhookUrl = `${backendDomain}/api/v1/webhooks/airalo`;
        const result = await this.airaloService.submitOrderAsync({
          packageId: item.plan.providerPlanId,
          quantity: item.quantity,
          type: 'sim',
          webhookUrl,
        });
        await this.orderItemsService.update(item.id, {
          orderRequestId: result.request_id ?? null,
        });
      } catch (err) {
        this.logger.error(
          `Airalo order failed for plan ${item.planId}: ${(err as Error).message}`,
        );
      }
    }

    if (esimAccessItems.length > 0) {
      const totalEsimAccessAmount = esimAccessItems.reduce(
        (sum, i) => sum + i.plan.costPrice * i.quantity,
        0,
      );
      const txnId = `${order.orderNumber}-esimaccess`;
      try {
        const result = await this.esimAccessService.submitOrder({
          transactionId: txnId,
          amount: Math.round(totalEsimAccessAmount * 10000),
          packageInfoList: esimAccessItems.map((i) => ({
            packageCode: i.plan.providerPlanId,
            count: i.quantity,
            price: Math.round(i.plan.costPrice * 10000),
            periodNum: i.periodNum,
          })),
        });
        for (const item of esimAccessItems) {
          await this.orderItemsService.update(item.id, {
            orderRequestId: result.orderNo ?? null,
          });
        }
      } catch (err) {
        this.logger.error(`EsimAccess order failed: ${(err as Error).message}`);
      }
    }

    if (gadgetKoreaItems.length > 0) {
      const gkOrderId = `${order.orderNumber}-gk`;
      const topupIdMap = new Map<string, string>();
      try {
        const result = await this.gadgetKoreaService.submitOrder({
          orderId: gkOrderId,
          products: gadgetKoreaItems.map((i) => ({
            optionId: i.plan.providerPlanId.toLowerCase(),
            qty: i.quantity,
          })),
        });
        for (const p of result.products ?? []) {
          if (p.topupId && p.optionId) {
            topupIdMap.set(p.optionId.toLowerCase(), p.topupId);
          }
        }
      } catch (err) {
        this.logger.error(
          `Gadget Korea order failed: ${(err as Error).message}`,
        );
      }

      for (const item of gadgetKoreaItems) {
        const topupId =
          topupIdMap.get(item.plan.providerPlanId.toLowerCase()) ?? null;
        if (topupId) {
          await this.orderItemsService.update(item.id, {
            orderRequestId: topupId,
          });
        }
      }
    }

    // 8. Local providers (esimvn) — assign available esims from inventory
    const localOrderItemIds: number[] = [];
    for (const item of localItems) {
      try {
        const availableEsims = await this.esimsService.findAvailableByPlanId(
          item.planId,
          item.quantity,
        );

        if (availableEsims.length < item.quantity) {
          this.logger.warn(
            `Not enough local esims for plan ${item.planId}: need ${item.quantity}, found ${availableEsims.length}`,
          );
        }

        for (const esim of availableEsims) {
          await this.esimsService.update(esim.id, {
            orderItemId: item.id,
            userId: order.userId,
            status: 'assigned',
          });
        }

        const completed = availableEsims.length >= item.quantity;
        await this.orderItemsService.update(item.id, {
          status: completed ? 'completed' : 'pending',
        });
        if (completed) localOrderItemIds.push(item.id);
      } catch (err) {
        this.logger.error(
          `Local esim assignment failed for plan ${item.planId}: ${(err as Error).message}`,
        );
      }
    }

    // Send esim purchase email for local items
    await this.sendEsimPurchaseEmails(
      order.userId,
      order.orderNumber,
      localOrderItemIds,
      localItems,
    );
  }

  private async sendEsimPurchaseEmails(
    userId: number,
    orderNumber: string,
    orderItemIds: number[],
    localItems: Array<{ planId: number; plan: { name: string } }>,
  ): Promise<void> {
    if (orderItemIds.length === 0) return;

    try {
      const user = await this.usersService.findById(userId);
      if (!user?.email) return;

      const esims = await this.esimsService.findByOrderItemIds(orderItemIds);

      for (const esim of esims) {
        const plan = localItems.find((i) => i.planId === esim.planId);
        await this.mailService.sendEsimPurchase({
          to: user.email,
          esimId: esim.id,
          iccid: esim.iccid,
          activationCode: esim.activationCode,
          lpa: esim.lpa,
          smdpAddress: esim.smdpAddress,
          apn: esim.apnValue,
          phoneNumber: esim.phoneNumber,
          planName: plan?.plan.name ?? '',
          orderNumber,
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to send esim purchase email: ${(err as Error).message}`,
      );
    }
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderDto | null;
    sortOptions?: SortOrderDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Order[]> {
    return this.orderRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: Order['id']): Promise<NullableType<Order>> {
    return this.orderRepository.findById(id);
  }

  async findDetailById(id: Order['id']): Promise<AdminOrderDetailDto | null> {
    const order = await this.orderRepository.findById(id);
    if (!order) return null;

    const orderItems = await this.orderItemsService.findByOrderId(order.id);

    const [esims, plans, user, coupon] = await Promise.all([
      this.esimsService.findByOrderItemIds(orderItems.map((i) => i.id)),
      Promise.all(orderItems.map((i) => this.plansService.findById(i.planId))),
      this.usersService.findById(order.userId),
      order.couponCode
        ? this.couponsService.findByCode(order.couponCode)
        : Promise.resolve(null),
    ]);

    const esimsByOrderItemId = new Map<number, typeof esims>();
    for (const esim of esims) {
      if (esim.orderItemId == null) continue;
      const list = esimsByOrderItemId.get(esim.orderItemId) ?? [];
      list.push(esim);
      esimsByOrderItemId.set(esim.orderItemId, list);
    }

    return {
      id: order.id,
      userId: order.userId,
      user: user
        ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          }
        : null,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
      paymentId: order.paymentId,
      couponCode: order.couponCode,
      discountAmount: order.discountAmount,
      vndPrice: order.vndPrice,
      vndCostPrice: order.vndCostPrice,
      coupon: coupon ?? null,
      items: orderItems.map((item, idx) => {
        const plan = plans[idx];
        return {
          id: item.id,
          planId: item.planId,
          plan: plan
            ? {
                id: plan.id,
                name: plan.name,
                slug: plan.slug,
                durationDays: plan.durationDays,
                dataMb: plan.dataMb,
                price: plan.price,
                vndPrice: plan.vndPrice,
                currency: plan.currency,
                speed: plan.speed,
                operatorName: plan.operatorName,
                countryCode: plan.countryCode,
                provider: plan.provider,
              }
            : null,
          orderRequestId: item.orderRequestId,
          providerOrderId: item.providerOrderId,
          providerOrderCode: item.providerOrderCode,
          status: item.status,
          price: item.price,
          currency: item.currency,
          quantity: item.quantity,
          vndPrice: item.vndPrice,
          vndCostPrice: item.vndCostPrice,
          esims: esimsByOrderItemId.get(item.id) ?? [],
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async update(
    id: Order['id'],
    updateOrderDto: Partial<Order> & UpdateOrderDto,
  ): Promise<Order | null> {
    return this.orderRepository.update(id, {
      ...(updateOrderDto.userId !== undefined && {
        userId: updateOrderDto.userId,
      }),
      ...(updateOrderDto.orderNumber !== undefined && {
        orderNumber: updateOrderDto.orderNumber,
      }),
      ...(updateOrderDto.status !== undefined && {
        status: updateOrderDto.status,
      }),
      ...(updateOrderDto.totalAmount !== undefined && {
        totalAmount: updateOrderDto.totalAmount,
      }),
      ...(updateOrderDto.currency !== undefined && {
        currency: updateOrderDto.currency,
      }),
      ...(updateOrderDto.paymentMethod !== undefined && {
        paymentMethod: updateOrderDto.paymentMethod,
      }),
      ...(updateOrderDto.paymentId !== undefined && {
        paymentId: updateOrderDto.paymentId,
      }),
      ...(updateOrderDto.cashbackTransactionId !== undefined && {
        cashbackTransactionId: updateOrderDto.cashbackTransactionId,
      }),
      ...(updateOrderDto.cashbackReversedAt !== undefined && {
        cashbackReversedAt: updateOrderDto.cashbackReversedAt,
      }),
      ...(updateOrderDto.refundStatus !== undefined && {
        refundStatus: updateOrderDto.refundStatus,
      }),
      ...(updateOrderDto.refundedAmountVnd !== undefined && {
        refundedAmountVnd: updateOrderDto.refundedAmountVnd,
      }),
    });
  }

  async finalizePaidOrder(
    id: Order['id'],
    payload: { paymentMethod: string; paymentId?: string | null },
  ): Promise<Order | null> {
    const updatedOrder = await this.update(id, {
      status: 'paid',
      paymentMethod: payload.paymentMethod,
      paymentId: payload.paymentId ?? null,
    });
    if (updatedOrder) {
      await this.walletsService.completePaidOrderBenefits(updatedOrder);
    }
    return updatedOrder;
  }

  async releaseWalletHoldForOrder(orderId: number): Promise<void> {
    await this.walletsService.releaseHoldForOrder(orderId);
  }

  async refundOrder(id: Order['id'], dto: RefundOrderDto, adminId: number) {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    // Cancel with suppliers before processing refund
    await this.cancelOrderWithSuppliers(order.id);

    return this.walletsService.refundOrder(order, dto, adminId);
  }

  /**
   * Cancel order items with their respective suppliers.
   * - Airalo: skip (no cancel API)
   * - EsimAccess: call POST /api/v1/open/esim/cancel with esimTranNo from esim table
   * - Gadget Korea: call POST /api/v2/cancel/{orderRequestId} from order-item
   * - Viettel (local): clear userId and orderItemId in esim table
   */
  private async cancelOrderWithSuppliers(orderId: number): Promise<void> {
    const orderItems = await this.orderItemsService.findByOrderId(orderId);

    const itemsWithPlans = await Promise.all(
      orderItems.map(async (oi) => {
        const plan = await this.plansService.findById(oi.planId);
        return { ...oi, plan };
      }),
    );

    for (const item of itemsWithPlans) {
      if (!item.plan) continue;

      try {
        if (item.plan.provider === 'esimaccess') {
          // Cancel esimaccess: find esims by orderItemId and cancel each by esimTranNo
          const esims = await this.esimsService.findByOrderItemIds([item.id]);
          for (const esim of esims) {
            if (esim.esimTranNo) {
              await this.esimAccessService.cancelEsim(esim.esimTranNo);
            }
          }
        } else if (item.plan.provider === 'gadgetkorea') {
          // Cancel gadgetkorea: use orderRequestId from order-item
          if (item.orderRequestId) {
            await this.gadgetKoreaService.cancelOrder(item.orderRequestId);
          }
        } else if (item.plan.isLocalInventory) {
          // Viettel (local): clear userId and orderItemId in esim table
          const esims = await this.esimsService.findByOrderItemIds([item.id]);
          for (const esim of esims) {
            await this.esimsService.update(esim.id, {
              userId: null,
              orderItemId: null,
              status: 'available',
            });
          }
        }
        // Airalo: skip — no cancel API
      } catch (err) {
        this.logger.error(
          `Failed to cancel order item ${item.id} with provider ${item.plan.provider}: ${(err as Error).message}`,
        );
        // Continue with refund even if supplier cancellation fails
      }
    }
  }

  async remove(id: Order['id']): Promise<void> {
    await this.orderRepository.remove(id);
  }

  async applyCouponAndClearCart(
    couponCode: string,
    userId: number,
  ): Promise<void> {
    await this.couponsService.applyCoupon(couponCode);
    await this.cartsService.clearCart(userId);
  }

  async clearCartForUser(userId: number): Promise<void> {
    await this.cartsService.clearCart(userId);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async failExpiredPendingOrders(): Promise<void> {
    const count = await this.orderRepository.failExpiredPendingOrders(30);
    if (count > 0) {
      this.logger.log(`Auto-failed ${count} expired pending orders`);
    }
  }
}
