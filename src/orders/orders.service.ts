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
import { JapanTravelSimService } from '../esim-providers/japantravelsim/japantravelsim.service';
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
import { InvoiceRepository } from '../invoices/infrastructure/persistence/invoice.repository';
import { InvoiceStatus } from '../invoices/invoices.enum';

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
    private readonly japanTravelSimService: JapanTravelSimService,
    private readonly configService: ConfigService<AllConfigType>,
    @Inject(forwardRef(() => CouponsService))
    private readonly couponsService: CouponsService,
    private readonly esimsService: EsimsService,
    private readonly cartsService: CartsService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    private readonly invoiceRepository: InvoiceRepository,
  ) {}

  /**
   * Persist the optional invoice request that comes alongside a checkout payload.
   * Errors are logged but never propagate — invoice creation must not block
   * order placement / payment.
   */
  private async createInvoiceForCheckoutIfRequested(
    order: Order,
    invoiceDto: SubmitOrderDto['invoice'],
  ): Promise<void> {
    if (!invoiceDto) return;
    try {
      await this.invoiceRepository.create({
        status: InvoiceStatus.PENDING,
        companyName: invoiceDto.companyName,
        taxCode: invoiceDto.taxCode,
        address: invoiceDto.address,
        invoiceEmail: invoiceDto.invoiceEmail,
        orderId: order.id,
        order,
      });
      this.logger.log(
        `Invoice request stored for order ${order.orderNumber} (id=${order.id})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to create invoice for order ${order.orderNumber}: ${(err as Error).message}`,
      );
    }
  }

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
    // Save phone number to user profile
    if (dto.phoneNumber) {
      try {
        await this.usersService.update(userId, {
          phoneNumber: dto.phoneNumber,
        });
      } catch {
        // Non-blocking: phone save failure should not block order
      }
    }

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
    const japanTravelSimItems = planDetails.filter(
      (i) => i.plan.provider === 'japantravelsim',
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

    // 8. Call JapanTravelSim API
    if (japanTravelSimItems.length > 0) {
      const user = await this.usersService.findById(userId);
      const userEmail = user?.email ?? 'noreply@esimvn.com';

      // Batch into groups of 10
      const channelOrderIdMap = new Map<string, string>();
      for (let i = 0; i < japanTravelSimItems.length; i += 10) {
        const batch = japanTravelSimItems.slice(i, i + 10);
        try {
          const result = await this.japanTravelSimService.submitOrder({
            orderId: `${orderNumber}-jts-${i}`,
            items: batch.map((item, idx) => {
              const [wrGroup, deviceSkuId] = item.plan.providerPlanId.includes(
                ':',
              )
                ? item.plan.providerPlanId.split(':')
                : ['plan', item.plan.providerPlanId];
              return {
                OrderId: `${orderNumber}-jts-${i + idx}`,
                wrGroup,
                deviceSkuId,
                days: item.plan.durationDays,
                email: userEmail,
              };
            }),
          });
          for (const d of result.data ?? []) {
            channelOrderIdMap.set(d.OrderId, d.channelOrderId);
          }
        } catch (err) {
          this.logger.error(
            `JapanTravelSim order failed: ${(err as Error).message}`,
          );
        }
      }

      for (let idx = 0; idx < japanTravelSimItems.length; idx++) {
        const item = japanTravelSimItems[idx];
        const itemOrderId = `${orderNumber}-jts-${idx}`;
        const channelOrderId = channelOrderIdMap.get(itemOrderId) ?? null;
        await this.orderItemsService.create({
          orderId: order.id,
          planId: item.planId,
          orderRequestId: channelOrderId,
          status: 'pending',
          price: item.plan.price,
          currency: dto.currency,
          quantity: item.quantity,
        });
      }

      // Schedule callback poll after 60s
      const allChannelOrderIds = [...channelOrderIdMap.values()];
      this.japanTravelSimService.scheduleCallbackAfterSubmit(
        allChannelOrderIds,
      );
    }

    // 9. Local providers (esimvn) — assign available esims from inventory
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
            status: 'sold',
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

    // Persist optional invoice request (customer ticked "Xuất hóa đơn" at checkout)
    await this.createInvoiceForCheckoutIfRequested(order, dto.invoice);

    return order;
  }

  async createPendingOrder(
    userId: number,
    dto: SubmitOrderDto,
    orderNumber: string,
    vndRate?: number,
  ): Promise<Order> {
    // Save phone number to user profile if provided and user doesn't have one yet
    if (dto.phoneNumber) {
      try {
        await this.usersService.update(userId, {
          phoneNumber: dto.phoneNumber,
        });
      } catch {
        // Non-blocking
      }
    }

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

    const totalVndCostPrice = planDetails.reduce((sum, item) => {
      if (item.plan.isLocalInventory) {
        return sum + Math.round(item.plan.costPrice) * item.quantity;
      }
      return (
        sum +
        (vndRate
          ? Math.round(item.plan.costPrice * vndRate) * item.quantity
          : 0)
      );
    }, 0);

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
      const itemVndCostPrice = item.plan.isLocalInventory
        ? Math.round(item.plan.costPrice) * item.quantity
        : vndRate
          ? Math.round(item.plan.costPrice * vndRate) * item.quantity
          : 0;

      await this.orderItemsService.create({
        orderId: order.id,
        planId: item.planId,
        orderRequestId: null,
        status: 'pending',
        price: item.plan.price,
        currency: item.plan.isLocalInventory ? 'VND' : dto.currency,
        quantity: item.quantity,
        vndPrice: getDiscountedVndPrice(item.plan) * item.quantity,
        vndCostPrice: itemVndCostPrice,
        periodNum: item.periodNum ?? null,
      });
    }

    // Persist optional invoice request (customer ticked "Xuất hóa đơn" at checkout)
    await this.createInvoiceForCheckoutIfRequested(order, dto.invoice);

    return order;
  }

  private async calculateOrderPricing(
    userId: number,
    dto: SubmitOrderDto,
    planDetails: OrderPlanDetail[],
  ): Promise<OrderPricing> {
    // totalAmount in USD — exclude local inventory (their price is already VND)
    const totalAmount = planDetails.reduce((sum, item) => {
      if (item.plan.isLocalInventory) return sum;
      return sum + item.plan.price * item.quantity;
    }, 0);
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
      walletSpentVndAmount: order.walletSpentVndAmount,
      cashbackAmountVnd: order.cashbackAmountVnd,
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
                locationInfo: this.buildLocationInfo(plan),
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

  async submitProviders(
    orderId: number,
    options: { mutedEmail?: boolean } = {},
  ): Promise<void> {
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
    const japanTravelSimItems = itemsWithPlans.filter(
      (i) => i.plan.provider === 'japantravelsim',
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

    // 8. Call JapanTravelSim API
    if (japanTravelSimItems.length > 0) {
      const user = await this.usersService.findById(order.userId);
      const userEmail = user?.email ?? 'noreply@esimvn.com';

      const channelOrderIdMap = new Map<string, string>();
      for (let i = 0; i < japanTravelSimItems.length; i += 10) {
        const batch = japanTravelSimItems.slice(i, i + 10);
        try {
          const result = await this.japanTravelSimService.submitOrder({
            orderId: `${order.orderNumber}-jts-${i}`,
            items: batch.map((item, idx) => {
              const [wrGroup, deviceSkuId] = item.plan.providerPlanId.includes(
                ':',
              )
                ? item.plan.providerPlanId.split(':')
                : ['plan', item.plan.providerPlanId];
              return {
                OrderId: `${order.orderNumber}-jts-${i + idx}`,
                wrGroup,
                deviceSkuId,
                days: item.plan.durationDays,
                email: userEmail,
              };
            }),
          });
          for (const d of result.data ?? []) {
            channelOrderIdMap.set(d.OrderId, d.channelOrderId);
          }
        } catch (err) {
          this.logger.error(
            `JapanTravelSim order failed: ${(err as Error).message}`,
          );
        }
      }

      for (let idx = 0; idx < japanTravelSimItems.length; idx++) {
        const item = japanTravelSimItems[idx];
        const itemOrderId = `${order.orderNumber}-jts-${idx}`;
        const channelOrderId = channelOrderIdMap.get(itemOrderId) ?? null;
        if (channelOrderId) {
          await this.orderItemsService.update(item.id, {
            orderRequestId: channelOrderId,
          });
        }
      }

      // Schedule callback poll after 60s
      const allChannelOrderIds = [...channelOrderIdMap.values()];
      this.japanTravelSimService.scheduleCallbackAfterSubmit(
        allChannelOrderIds,
      );
    }

    // 9. Local providers (esimvn) — assign available esims from inventory
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
            status: 'sold',
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

    // Send esim purchase email for local items (skip when muted, e.g. admin manual orders)
    if (!options.mutedEmail) {
      await this.sendEsimPurchaseEmails(
        order.userId,
        order.orderNumber,
        localOrderItemIds,
        localItems,
      );
    } else {
      this.logger.log(
        `submitProviders: muted email for order ${order.orderNumber}`,
      );
    }
  }

  /**
   * Admin "đặt đơn hộ" — bypass OnePay/QR generation, mark order PAID immediately,
   * provision eSIMs via providers, and never auto-send the eSIM email.
   * The admin will trigger {@link resendEsimEmail} manually after verifying
   * the offline payment.
   */
  async submitManualOrder(
    adminUserId: number,
    dto: { email: string; packageCode: string; slug: string; quantity: number },
  ): Promise<Order> {
    // 1. Resolve buyer by email
    const buyer = await this.usersService.findByEmail(dto.email);
    if (!buyer) {
      throw new NotFoundException(
        `Buyer with email ${dto.email} not found. Please ensure the user account exists.`,
      );
    }

    // 2. Resolve plan by slug (primary) and verify packageCode
    const plan = await this.plansService.findBySlug(dto.slug);
    if (!plan) {
      throw new NotFoundException(`Plan slug ${dto.slug} not found`);
    }
    if (plan.providerPlanId !== dto.packageCode) {
      throw new BadRequestException(
        `Plan slug ${dto.slug} does not match packageCode ${dto.packageCode} (expected ${plan.providerPlanId})`,
      );
    }

    // 3. Build a SubmitOrderDto-compatible payload (no coupon/wallet/referral for manual orders)
    const submitDto: SubmitOrderDto = {
      currency: plan.currency,
      items: [{ planId: plan.id, quantity: dto.quantity }],
      paymentMethod: 'admin_manual',
    };

    // 4. Create pending order at VND rate (use 1 to avoid hitting the FX API; cost figures
    // are not critical for an admin-bypassed order, the payable VND price is still correct).
    const orderNumber = `MAN-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
    const order = await this.createPendingOrder(
      Number(buyer.id),
      submitDto,
      orderNumber,
    );

    this.logger.log(
      `Admin ${adminUserId} created manual order ${orderNumber} for buyer ${buyer.id} (${dto.email}) — plan ${plan.slug} x${dto.quantity}`,
    );

    // 5. Mark as PAID via internal admin approval (no OnePay).
    // Mute auto invoice email — admin manually triggers it after verifying
    // the offline payment using `resendEsimEmail`.
    await this.finalizePaidOrder(order.id, {
      paymentMethod: 'admin_manual',
      paymentId: `ADMIN-${adminUserId}`,
      mutedEmail: true,
    });

    // 6. Provision with providers but mute the auto email
    try {
      await this.submitProviders(order.id, { mutedEmail: true });
    } catch (err) {
      this.logger.error(
        `submitManualOrder: provider submission failed for ${orderNumber}: ${(err as Error).message}`,
      );
    }

    const finalOrder = await this.orderRepository.findById(order.id);
    return finalOrder ?? order;
  }

  /**
   * Resend the eSIM activation email for an existing paid order. Looks up the
   * eSIMs already stored against the order's items and reuses the same mail
   * template as the initial purchase flow.
   *
   * This action is strictly eSIM-only. Sending the invoice email is a separate
   * concern handled by the "Issue invoice" flow (PATCH /invoices/:id with
   * status = ISSUED). Mixing the two channels into one button caused
   * misleading UX where clicking "Resend eSIM" would silently dispatch an
   * invoice mail.
   */
  async resendEsimEmail(orderId: number): Promise<{
    sent: number;
    skippedReason?: string;
  }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const buyer = await this.usersService.findById(order.userId);
    if (!buyer?.email) {
      return { sent: 0, skippedReason: 'buyer-has-no-email' };
    }

    const orderItems = await this.orderItemsService.findByOrderId(orderId);
    if (!orderItems.length) {
      return { sent: 0, skippedReason: 'no-order-items' };
    }

    const esims = await this.esimsService.findByOrderItemIds(
      orderItems.map((i) => i.id),
    );

    if (esims.length === 0) {
      this.logger.warn(
        `resendEsimEmail: no esims provisioned yet for order ${orderId}`,
      );
      return { sent: 0, skippedReason: 'no-esims-provisioned-yet' };
    }

    const plansById = new Map<number, Plan>();
    for (const item of orderItems) {
      if (!plansById.has(item.planId)) {
        const plan = await this.plansService.findById(item.planId);
        if (plan) plansById.set(item.planId, plan);
      }
    }

    let sent = 0;
    for (const esim of esims) {
      const plan = esim.planId != null ? plansById.get(esim.planId) : undefined;
      try {
        await this.mailService.sendEsimPurchase({
          to: buyer.email,
          esimId: esim.id,
          qrAccessToken: esim.qrAccessToken,
          iccid: esim.iccid,
          activationCode: esim.activationCode,
          lpa: esim.lpa,
          smdpAddress: esim.smdpAddress,
          apn: esim.apnValue,
          phoneNumber: esim.phoneNumber,
          planName: plan?.name ?? '',
          orderNumber: order.orderNumber,
        });
        sent += 1;
      } catch (err) {
        this.logger.error(
          `resendEsimEmail: failed to send for esim ${esim.id} of order ${orderId}: ${(err as Error).message}`,
        );
      }
    }

    return { sent };
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
          qrAccessToken: esim.qrAccessToken,
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

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterOrderDto | null;
    sortOptions?: SortOrderDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Order[], number]> {
    const [orders, count] = await this.orderRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);

      // Batch fetch invoice existence and item counts
      const [invoiceOrderIds, itemCounts] = await Promise.all([
        this.invoiceRepository.findOrderIdsWithInvoice(orderIds),
        this.orderItemsService.countByOrderIds(orderIds),
      ]);

      const invoiceSet = new Set(invoiceOrderIds);
      for (const order of orders) {
        order.isInvoice = invoiceSet.has(order.id);
        order.itemCount = itemCounts.get(order.id) ?? 0;
      }
    }

    return [orders, count];
  }

  findById(id: Order['id']): Promise<NullableType<Order>> {
    return this.orderRepository.findById(id);
  }

  async findDetailById(id: Order['id']): Promise<AdminOrderDetailDto | null> {
    const order = await this.orderRepository.findById(id);
    if (!order) return null;

    const orderItems = await this.orderItemsService.findByOrderId(order.id);

    const [esims, plans, user, coupon, invoice] = await Promise.all([
      this.esimsService.findByOrderItemIds(orderItems.map((i) => i.id)),
      Promise.all(orderItems.map((i) => this.plansService.findById(i.planId))),
      this.usersService.findById(order.userId),
      order.couponCode
        ? this.couponsService.findByCode(order.couponCode)
        : Promise.resolve(null),
      this.invoiceRepository.findByOrderId(order.id),
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
            phoneNumber: user.phoneNumber ?? null,
          }
        : null,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
      paymentId: order.paymentId,
      couponCode: order.couponCode,
      referralCode: order.referralCode ?? null,
      referralDiscountVndAmount: order.referralDiscountVndAmount ?? 0,
      discountAmount: order.discountAmount,
      vndPrice: order.vndPrice,
      vndCostPrice: order.vndCostPrice,
      walletSpentVndAmount: order.walletSpentVndAmount,
      cashbackAmountVnd: order.cashbackAmountVnd,
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
                locationInfo: this.buildLocationInfo(plan),
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
      invoice: invoice
        ? {
            id: invoice.id,
            status: invoice.status,
            companyName: invoice.companyName,
            taxCode: invoice.taxCode,
            address: invoice.address,
            invoiceEmail: invoice.invoiceEmail,
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt,
          }
        : null,
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
    payload: {
      paymentMethod: string;
      paymentId?: string | null;
      mutedEmail?: boolean;
    },
  ): Promise<Order | null> {
    const updatedOrder = await this.update(id, {
      status: 'paid',
      paymentMethod: payload.paymentMethod,
      paymentId: payload.paymentId ?? null,
    });
    if (updatedOrder) {
      await this.walletsService.completePaidOrderBenefits(updatedOrder);
      // Auto-send the invoice confirmation email when an invoice request was
      // attached to the order at checkout. Skip when explicitly muted, e.g.
      // admin "đặt đơn hộ" (the admin will trigger this manually after
      // verifying the offline payment).
      if (!payload.mutedEmail) {
        await this.sendInvoiceEmailIfRequested(updatedOrder);
      }
    }
    return updatedOrder;
  }

  /**
   * Look up the optional invoice request attached to an order and send the
   * invoice-issued email to the customer's `invoiceEmail`. Errors are logged
   * but never propagated — the email is a side-effect of paid-order
   * finalization and must not break that flow.
   */
  private async sendInvoiceEmailIfRequested(order: Order): Promise<void> {
    try {
      const invoice = await this.invoiceRepository.findByOrderId(order.id);
      if (!invoice) return;

      await this.mailService.sendInvoiceIssued({
        to: invoice.invoiceEmail,
        orderNumber: order.orderNumber,
        companyName: invoice.companyName,
        taxCode: invoice.taxCode,
        address: invoice.address,
        totalAmountVnd: order.payableVndPrice ?? order.vndPrice ?? 0,
      });
      this.logger.log(
        `Invoice email sent for order ${order.orderNumber} to ${invoice.invoiceEmail}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send invoice email for order ${order.orderNumber}: ${(err as Error).message}`,
      );
    }
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
          // Viettel (local): mark esim as refunded
          const esims = await this.esimsService.findByOrderItemIds([item.id]);
          for (const esim of esims) {
            await this.esimsService.update(esim.id, {
              userId: null,
              orderItemId: null,
              status: 'refunded',
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

  /**
   * Feature 3.1 — Instant cancel for a PENDING order.
   *
   * Mirrors the resource-rollback contract that the cron-job @ {@link failExpiredPendingOrders}
   * was indirectly applying after 30 minutes, except the cancel happens
   * immediately so the buyer can re-use coupons / referral codes / wallet
   * eXu balance for a new order without waiting.
   *
   * Strict guards:
   *   • only the order's owner (or an admin via {@link cancelOrder}) can
   *     cancel — the user check is enforced at the controller level.
   *   • only orders in PENDING status are cancellable. Orders that are
   *     already paid, refunded, failed or topup-related must go through
   *     the refund workflow instead.
   *
   * Resource rollback (best effort, errors logged but never propagated):
   *   1. status → FAILED (matches the cron job's terminology + downstream
   *      reporting).
   *   2. release the wallet hold so the eXu balance becomes immediately
   *      available again.
   *   3. decrement the coupon `usageCount` so it can be re-applied.
   *   4. reverse any pending referral so the referral code is freed up.
   */
  async cancelOrder(orderId: number, userId?: number): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (userId !== undefined && order.userId !== userId) {
      throw new BadRequestException('Bạn không có quyền hủy đơn hàng này.');
    }

    if (order.status !== 'pending') {
      throw new BadRequestException(
        `Chỉ có thể hủy đơn đang chờ thanh toán. Trạng thái hiện tại: ${order.status}`,
      );
    }

    // 1. Move the order to FAILED — this matches the cron-job terminology
    // and removes the order from the buyer's "đang chờ thanh toán" list.
    const updated = await this.orderRepository.update(order.id, {
      status: 'failed',
    });
    if (!updated) {
      throw new NotFoundException(`Order ${orderId} not found after update`);
    }

    // 2-4. Release wallet hold, decrement coupon usage, reverse pending
    //      referral. Each step is independent so a failure in one does not
    //      block the others — the order has already been moved to FAILED.
    try {
      await this.walletsService.releaseHoldForOrder(order.id);
    } catch (err) {
      this.logger.error(
        `cancelOrder: failed to release wallet hold for order ${order.id}: ${(err as Error).message}`,
      );
    }

    if (order.couponCode) {
      try {
        await this.couponsService.releaseCoupon(order.couponCode);
      } catch (err) {
        this.logger.error(
          `cancelOrder: failed to release coupon ${order.couponCode} for order ${order.id}: ${(err as Error).message}`,
        );
      }
    }

    try {
      await this.walletsService.reversePendingReferralForOrder(order.id);
    } catch (err) {
      this.logger.error(
        `cancelOrder: failed to reverse pending referral for order ${order.id}: ${(err as Error).message}`,
      );
    }

    this.logger.log(
      `cancelOrder: order ${order.orderNumber} (id=${order.id}) cancelled by ${
        userId !== undefined ? `user ${userId}` : 'admin'
      } — coupon=${order.couponCode ?? '-'}, referral=${order.referralCode ?? '-'}, walletHold=${order.walletSpentVndAmount}`,
    );

    return updated;
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

  /**
   * Soft-delete failed orders older than 1 week to free resources.
   * Runs daily at 3:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupFailedOrders(): Promise<void> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const deleted = await this.orderRepository.softDeleteByStatusOlderThan(
      'failed',
      oneWeekAgo,
    );

    if (deleted > 0) {
      this.logger.log(`Cleaned up ${deleted} failed orders older than 1 week`);
    }
  }

  /**
   * Part 12 Feature 3.1 — Build locationInfo from plan's destination or region.
   * Returns null if neither destination nor region is populated.
   */
  private buildLocationInfo(plan: Plan): {
    type: string;
    locationCode: string | null;
    slug: string;
    title: string | null;
    titleVi: string | null;
    thumbnailUrl: string | null;
  } | null {
    if (plan.destination) {
      return {
        type: 'DESTINATION',
        locationCode: plan.destination.countryCode ?? null,
        slug: plan.destination.slug,
        title: plan.destination.title ?? null,
        titleVi: plan.destination.titleVi ?? null,
        thumbnailUrl:
          plan.destination.avatarUrl ?? plan.destination.flagUrl ?? null,
      };
    }

    if (plan.region) {
      return {
        type: 'REGION',
        locationCode: null,
        slug: plan.region.slug,
        title: plan.region.title ?? null,
        titleVi: plan.region.titleVi ?? null,
        thumbnailUrl: plan.region.avatarUrl ?? null,
      };
    }

    return null;
  }
}
