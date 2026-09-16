import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
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
import { MicroEsimService } from '../esim-providers/microesim/microesim.service';
import { BillionService } from '../esim-providers/billion/billion.service';
import { parseBillionPlanId } from '../esim-providers/billion/billion-catalogue';
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
import { RefundOrderDto } from '../wallets/dto/admin-wallet.dto';
import { MembershipTierEnum, TierSourceEnum } from '../wallets/tier/tier.enum';
import { InvoiceRepository } from '../invoices/infrastructure/persistence/invoice.repository';
import { InvoiceStatus } from '../invoices/invoices.enum';
import { PartnersService } from '../partners/partners.service';

const VND_ROUNDING_UNIT = 1000;

/**
 * What share of an order a commission came to (#095).
 *
 * The commission row stores dong, not a percentage — the rate can change per
 * tier and per campaign — so the figure an admin sees is worked out against
 * the money the order actually took, which is the number they are checking it
 * against anyway.
 */
function commissionShareOfOrder(
  commissionVnd: number,
  order: { subtotalVndPrice?: number | null; vndPrice?: number | null },
): number {
  const base = Number(order.subtotalVndPrice ?? order.vndPrice ?? 0);
  if (!(base > 0) || !(commissionVnd > 0)) return 0;
  return Math.round((commissionVnd / base) * 1000) / 10;
}
function roundVndToThousands(amount: number): number {
  return Math.round(amount / VND_ROUNDING_UNIT) * VND_ROUNDING_UNIT;
}

function getPlanPeriodMultiplier(
  plan: Plan,
  periodNum?: number | null,
): number {
  if (!plan.isAbleMultidate) return 1;
  return Math.max(1, Math.round(Number(periodNum ?? 1)));
}

export function getDiscountedVndPrice(
  plan: Plan,
  periodNum?: number | null,
): number {
  const multiplier = getPlanPeriodMultiplier(plan, periodNum);
  const vndPrice = (plan.vndPrice ?? 0) * multiplier;
  if (!plan.discount || plan.discount <= 0) return vndPrice;
  return roundVndToThousands(vndPrice * (1 - plan.discount / 100));
}

/**
 * Price of a plan in DOLLARS.
 *
 * `plan.price` is dollars for API suppliers but VND for local inventory, so
 * reading it directly recorded a đồng figure as USD on the order — roughly a
 * 25,000x overstatement on Viettel and other domestic plans (#037). `usdPrice`
 * is maintained in dollars for every provider by the hourly exchange-rate job.
 *
 * Falls back to 0 rather than to `price` for local plans: a missing dollar
 * figure is obvious, a VND number labelled USD is not.
 */
export function getPlanUsdPrice(plan: Plan, periodNum?: number | null): number {
  const multiplier = getPlanPeriodMultiplier(plan, periodNum);
  const usd = Number(plan.usdPrice ?? 0);

  if (usd > 0) return usd * multiplier;
  if (plan.isLocalInventory) return 0;

  return plan.price * multiplier;
}

function getPlanCostPrice(plan: Plan, periodNum?: number | null): number {
  return plan.costPrice * getPlanPeriodMultiplier(plan, periodNum);
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
  membershipTierSnapshot: MembershipTierEnum;
  tierSourceSnapshot: TierSourceEnum;
  cashbackPercentSnapshot: number;
  eligibleSpendVnd: number;
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
    private readonly microEsimService: MicroEsimService,
    private readonly billionService: BillionService,
    private readonly configService: ConfigService<AllConfigType>,
    @Inject(forwardRef(() => CouponsService))
    private readonly couponsService: CouponsService,
    private readonly esimsService: EsimsService,
    private readonly cartsService: CartsService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly partnersService: PartnersService,
  ) {}

  /**
   * Resolve an optional KOL partner-link code (from checkout, sourced from the
   * `esim_partner_link` cookie set at /go/[code]) into partner attribution
   * fields for the new order. Independent of coupon/referral — a buyer can
   * have both a discount code AND arrive via a KOL link.
   *
   * `clickedAt` is when the buyer last opened the link. The partner only earns
   * on an order placed within 30 days of that visit (#095, ý 3); the check
   * itself lives in `PartnersService.resolveLinkForAttribution`, which falls
   * back to the click log when the checkout sends no stamp.
   */
  private async resolvePartnerAttribution(
    partnerLinkCode?: string | null,
    clickedAt?: string | null,
  ): Promise<{
    partnerLinkCode: string | null;
    attributedPartnerId: number | null;
    linkId: number | null;
  }> {
    if (!partnerLinkCode) {
      return { partnerLinkCode: null, attributedPartnerId: null, linkId: null };
    }
    const parsedClickedAt = clickedAt ? new Date(clickedAt) : null;
    const resolved = await this.partnersService.resolveLinkForAttribution(
      partnerLinkCode,
      parsedClickedAt && !Number.isNaN(parsedClickedAt.getTime())
        ? parsedClickedAt
        : null,
    );
    if (!resolved) {
      return { partnerLinkCode: null, attributedPartnerId: null, linkId: null };
    }
    return {
      partnerLinkCode,
      attributedPartnerId: resolved.partnerId,
      linkId: resolved.linkId,
    };
  }

  /**
   * Create the PENDING commission snapshot for a newly-created order that
   * carries partner attribution. Errors are logged but never propagated —
   * commission bookkeeping must not block order placement.
   */
  private async createPendingCommissionIfAttributed(
    order: Order,
    attribution: { attributedPartnerId: number | null; linkId: number | null },
  ): Promise<void> {
    if (!attribution.attributedPartnerId) return;
    try {
      await this.partnersService.createPendingCommissionForOrder({
        orderId: order.id,
        partnerId: attribution.attributedPartnerId,
        linkId: attribution.linkId,
        // Lets the partners module refuse a partner buying through their own
        // link (#095).
        buyerUserId: order.userId,
        // Commission base is the order value AFTER discounts but BEFORE the
        // buyer's eXU wallet spend: eXU is the customer paying with store
        // credit, not a discount, so it must not shrink what the partner earns.
        // `payableVndPrice` subtracts it, `eligibleSpendVnd` does not.
        orderValueVnd:
          order.eligibleSpendVnd ??
          order.payableVndPrice ??
          order.vndPrice ??
          0,
      });
    } catch (err) {
      this.logger.error(
        `Failed to create pending partner commission for order ${order.id}: ${(err as Error).message}`,
      );
    }
  }

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
        invoicePhone: invoiceDto.invoicePhone,
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
      partnerLinkCode: null,
      attributedPartnerId: null,
      referralDiscountVndAmount: 0,
      walletSpentVndAmount: 0,
      payableVndPrice: 0,
      cashbackAmountVnd: 0,
      membershipTierSnapshot: MembershipTierEnum.TRAVELER,
      tierSourceSnapshot: TierSourceEnum.AUTOMATIC,
      cashbackPercentSnapshot: 2,
      eligibleSpendVnd: 0,
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
        // A plan taken off sale (a provider removed, like Japan Travel SIM in
        // #008, or dropped by the catalogue sync) could still sit in a cart;
        // charging for it would sell an eSIM nobody delivers.
        if (!plan.isActive) {
          throw new BadRequestException(
            `Plan ${item.planId} is no longer on sale`,
          );
        }
        return { ...item, plan };
      }),
    );

    const pricing = await this.calculateOrderPricing(userId, dto, planDetails);
    const attribution = await this.resolvePartnerAttribution(
      dto.partnerLinkCode,
      dto.partnerLinkClickedAt,
    );

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
      partnerLinkCode: attribution.partnerLinkCode,
      attributedPartnerId: attribution.attributedPartnerId,
      referralDiscountVndAmount: pricing.referralDiscountVndAmount,
      walletSpentVndAmount: pricing.walletSpentVndAmount,
      payableVndPrice: pricing.payableVndPrice,
      cashbackAmountVnd: pricing.cashbackAmountVnd,
      membershipTierSnapshot: pricing.membershipTierSnapshot,
      tierSourceSnapshot: pricing.tierSourceSnapshot,
      cashbackPercentSnapshot: pricing.cashbackPercentSnapshot,
      eligibleSpendVnd: pricing.eligibleSpendVnd,
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

    await this.createPendingCommissionIfAttributed(order, attribution);

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

    // 7. Call Gadget Korea API — one call for all gadgetkorea items.
    // The provider returns one topupId per unit (qty 2 → 2 topupIds), and the
    // webhook fires once per topupId. So we expand each line into one
    // order-item per unit (quantity = 1), each bound to its own topupId, to
    // keep a strict 1:1 mapping (order-item → topupId → eSIM webhook).
    if (gadgetKoreaItems.length > 0) {
      const gkOrderId = `${orderNumber}-gk`;
      // optionId -> queue of topupIds (one entry per unit)
      const topupIdsByOption = new Map<string, string[]>();
      try {
        const result = await this.gadgetKoreaService.submitOrder({
          orderId: gkOrderId,
          products: gadgetKoreaItems.map((i) => ({
            optionId: i.plan.providerPlanId.toLowerCase(),
            qty: i.quantity,
          })),
        });
        // result.products: [{ topupId, optionId }] — one per unit
        for (const p of result.products ?? []) {
          if (p.topupId && p.optionId) {
            const key = p.optionId.toLowerCase();
            const queue = topupIdsByOption.get(key) ?? [];
            queue.push(p.topupId);
            topupIdsByOption.set(key, queue);
          }
        }
      } catch (err) {
        this.logger.error(
          `Gadget Korea order failed: ${(err as Error).message}`,
        );
      }

      for (const item of gadgetKoreaItems) {
        const queue =
          topupIdsByOption.get(item.plan.providerPlanId.toLowerCase()) ?? [];
        for (let u = 0; u < item.quantity; u++) {
          const topupId = queue.shift() ?? null;
          await this.orderItemsService.create({
            orderId: order.id,
            planId: item.planId,
            orderRequestId: topupId,
            status: 'pending',
            price: item.plan.price,
            currency: dto.currency,
            quantity: 1,
          });
        }
      }
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
        // A plan taken off sale (a provider removed, like Japan Travel SIM in
        // #008, or dropped by the catalogue sync) could still sit in a cart;
        // charging for it would sell an eSIM nobody delivers.
        if (!plan.isActive) {
          throw new BadRequestException(
            `Plan ${item.planId} is no longer on sale`,
          );
        }
        return { ...item, plan };
      }),
    );

    const pricing = await this.calculateOrderPricing(userId, dto, planDetails);
    const attribution = await this.resolvePartnerAttribution(
      dto.partnerLinkCode,
      dto.partnerLinkClickedAt,
    );

    const totalVndCostPrice = planDetails.reduce((sum, item) => {
      const itemCostPrice = getPlanCostPrice(item.plan, item.periodNum);
      if (item.plan.isLocalInventory) {
        return sum + Math.round(itemCostPrice) * item.quantity;
      }
      return (
        sum +
        (vndRate ? Math.round(itemCostPrice * vndRate) * item.quantity : 0)
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
      partnerLinkCode: attribution.partnerLinkCode,
      attributedPartnerId: attribution.attributedPartnerId,
      referralDiscountVndAmount: pricing.referralDiscountVndAmount,
      walletSpentVndAmount: pricing.walletSpentVndAmount,
      payableVndPrice: pricing.payableVndPrice,
      cashbackAmountVnd: pricing.cashbackAmountVnd,
      membershipTierSnapshot: pricing.membershipTierSnapshot,
      tierSourceSnapshot: pricing.tierSourceSnapshot,
      cashbackPercentSnapshot: pricing.cashbackPercentSnapshot,
      eligibleSpendVnd: pricing.eligibleSpendVnd,
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

    await this.createPendingCommissionIfAttributed(order, attribution);

    if (pricing.walletSpentVndAmount > 0) {
      await this.walletsService.createHold(
        order.id,
        userId,
        pricing.walletSpentVndAmount,
      );
    }

    for (const item of planDetails) {
      const unitCostPrice = getPlanCostPrice(item.plan, item.periodNum);
      const itemVndCostPrice = item.plan.isLocalInventory
        ? Math.round(unitCostPrice) * item.quantity
        : vndRate
          ? Math.round(unitCostPrice * vndRate) * item.quantity
          : 0;

      // Gadget Korea returns one topupId per unit and the webhook fires once
      // per topupId, so expand into one order-item per unit (quantity = 1
      // each). Total price/cost is preserved because each row carries the
      // per-unit amounts.
      if (item.plan.provider === 'gadgetkorea') {
        const count = Math.max(1, item.quantity);
        for (let u = 0; u < count; u++) {
          await this.orderItemsService.create({
            orderId: order.id,
            planId: item.planId,
            orderRequestId: null,
            status: 'pending',
            price: getPlanUsdPrice(item.plan, item.periodNum),
            currency: dto.currency,
            quantity: 1,
            vndPrice: getDiscountedVndPrice(item.plan, item.periodNum),
            vndCostPrice: vndRate ? Math.round(unitCostPrice * vndRate) : 0,
            periodNum: item.periodNum ?? null,
          });
        }
        continue;
      }

      await this.orderItemsService.create({
        orderId: order.id,
        planId: item.planId,
        orderRequestId: null,
        status: 'pending',
        price: getPlanUsdPrice(item.plan, item.periodNum),
        currency: item.plan.isLocalInventory ? 'VND' : dto.currency,
        quantity: item.quantity,
        vndPrice:
          getDiscountedVndPrice(item.plan, item.periodNum) * item.quantity,
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
      return sum + getPlanUsdPrice(item.plan, item.periodNum) * item.quantity;
    }, 0);
    const subtotalVndPrice = planDetails.reduce(
      (sum, item) =>
        sum + getDiscountedVndPrice(item.plan, item.periodNum) * item.quantity,
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
      // Derive the USD discount from the share actually taken off, not the
      // coupon's configured percentage: a capped or flat-amount code (#082)
      // is no longer described by that number, and the two currencies would
      // disagree about the same order.
      const discountShare = couponResult.effectiveDiscountPercent / 100;
      discountAmount = Math.round(totalAmount * discountShare * 100) / 100;
    }

    const finalAmount = Math.round((totalAmount - discountAmount) * 100) / 100;
    const eligibleSpendVnd = Math.max(
      0,
      subtotalVndPrice - couponDiscountVndAmount - referralDiscountVndAmount,
    );
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    const membershipTierSnapshot =
      user.membershipTier ?? MembershipTierEnum.TRAVELER;
    const tierSourceSnapshot = user.tierSource ?? TierSourceEnum.AUTOMATIC;
    const cashbackPercentSnapshot = user.tierBenefits?.cashbackPercent ?? 2;
    const requestedWalletAmount = Math.max(
      0,
      Math.round(Number(dto.useWalletAmountVnd ?? 0)),
    );
    const walletSpentVndAmount = Math.min(
      requestedWalletAmount,
      eligibleSpendVnd,
    );
    const payableVndPrice = Math.max(
      0,
      eligibleSpendVnd - walletSpentVndAmount,
    );
    const cashbackAmountVnd = Math.round(
      (eligibleSpendVnd * cashbackPercentSnapshot) / 100,
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
      membershipTierSnapshot,
      tierSourceSnapshot,
      cashbackPercentSnapshot,
      eligibleSpendVnd,
      referral,
    };
  }

  async findByOrderNumber(orderNumber: string): Promise<NullableType<Order>> {
    return this.orderRepository.findByOrderNumber(orderNumber);
  }

  async findByBankTransferCode(code: string): Promise<NullableType<Order>> {
    return this.orderRepository.findByBankTransferCode(code);
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
                fupSpeed: plan.fupSpeed,
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

  /**
   * Ask the suppliers again for the eSIMs an order never received (#030).
   *
   * The usual cause is the deposit with a supplier running dry mid-order: the
   * customer has paid, some lines came back with an eSIM and the rest failed.
   * An admin tops the deposit up and presses the button.
   *
   * The important part is what it REFUSES to do. `submitProviders` orders every
   * line it is given, so running it again over a whole order would buy a second
   * eSIM for every line that already worked — real money, and duplicate eSIMs
   * for the customer. So a line is retried only when BOTH are true:
   *   - it has no eSIM yet, and
   *   - it has no provider order reference, i.e. the supplier never accepted it.
   * A line that was accepted but is still waiting on the provider's webhook
   * (Airalo, Billion, MicroEsim deliver asynchronously) is left alone.
   */
  async retryProvisioning(orderId: number): Promise<{
    retriedItemIds: number[];
    skippedItemIds: number[];
    message: string;
  }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (order.status !== 'paid') {
      throw new UnprocessableEntityException(
        `Order ${order.orderNumber} is ${order.status}; only a paid order can be re-sent to the supplier`,
      );
    }

    const items = await this.orderItemsService.findByOrderId(orderId);
    const esims = await this.esimsService.findByOrderItemIds(
      items.map((item) => Number(item.id)),
    );
    const itemIdsWithEsim = new Set(
      esims.map((esim) => Number(esim.orderItemId)),
    );

    const retriedItemIds: number[] = [];
    const skippedItemIds: number[] = [];

    for (const item of items) {
      const id = Number(item.id);
      const hasEsim = itemIdsWithEsim.has(id);
      const acceptedByProvider = !!item.orderRequestId;

      if (hasEsim || acceptedByProvider) {
        skippedItemIds.push(id);
      } else {
        retriedItemIds.push(id);
      }
    }

    if (retriedItemIds.length === 0) {
      return {
        retriedItemIds,
        skippedItemIds,
        message:
          'Không có sản phẩm nào cần gọi lại: tất cả đã có eSIM hoặc đã được nhà cung cấp tiếp nhận.',
      };
    }

    this.logger.log(
      `retryProvisioning: re-submitting items ${retriedItemIds.join(', ')} of order ${order.orderNumber}`,
    );

    await this.submitProviders(orderId, { onlyItemIds: retriedItemIds });

    return {
      retriedItemIds,
      skippedItemIds,
      message: `Đã gọi lại nhà cung cấp cho ${retriedItemIds.length} sản phẩm.`,
    };
  }

  /**
   * Order the eSIMs from the suppliers.
   *
   * `onlyItemIds` restricts the run to part of the order — used by the retry
   * button (#030) so lines that already came back with an eSIM are never
   * ordered a second time.
   */
  async submitProviders(
    orderId: number,
    options: { mutedEmail?: boolean; onlyItemIds?: number[] } = {},
  ): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const allItems = await this.orderItemsService.findByOrderId(orderId);
    const orderItems = options.onlyItemIds?.length
      ? allItems.filter((item) =>
          options.onlyItemIds!.includes(Number(item.id)),
        )
      : allItems;

    if (orderItems.length === 0) return;

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
    const microEsimItems = itemsWithPlans.filter(
      (i) => i.plan.provider === 'microesim',
    );
    const billionItems = itemsWithPlans.filter(
      (i) => i.plan.provider === 'billion',
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
      // optionId -> queue of topupIds (one entry per unit)
      const topupIdsByOption = new Map<string, string[]>();
      // Aggregate qty per optionId since items are now one-per-unit
      const qtyByOption = new Map<string, number>();
      for (const item of gadgetKoreaItems) {
        const key = item.plan.providerPlanId.toLowerCase();
        qtyByOption.set(key, (qtyByOption.get(key) ?? 0) + item.quantity);
      }
      try {
        const result = await this.gadgetKoreaService.submitOrder({
          orderId: gkOrderId,
          products: [...qtyByOption.entries()].map(([optionId, qty]) => ({
            optionId,
            qty,
          })),
        });
        for (const p of result.products ?? []) {
          if (p.topupId && p.optionId) {
            const key = p.optionId.toLowerCase();
            const queue = topupIdsByOption.get(key) ?? [];
            queue.push(p.topupId);
            topupIdsByOption.set(key, queue);
          }
        }
      } catch (err) {
        this.logger.error(
          `Gadget Korea order failed: ${(err as Error).message}`,
        );
      }

      for (const item of gadgetKoreaItems) {
        const queue =
          topupIdsByOption.get(item.plan.providerPlanId.toLowerCase()) ?? [];
        const topupId = queue.shift() ?? null;
        if (topupId) {
          await this.orderItemsService.update(item.id, {
            orderRequestId: topupId,
          });
        }
      }
    }

    // 8b. Call MicroEsim API — one esimSubscribe per order item (number = qty).
    // eSIMs are provisioned asynchronously: MicroEsim pushes to our webhook, and
    // MicroEsimService also schedules a topupDetail poll as a fallback.
    if (microEsimItems.length > 0) {
      const backendDomain = this.configService.getOrThrow('app.backendDomain', {
        infer: true,
      });
      const notifyUrl = `${backendDomain}/api/v1/webhooks/microesim`;
      const topupIds: string[] = [];

      for (const item of microEsimItems) {
        try {
          const topupId = await this.microEsimService.submitOrder({
            channelDataplanId: item.plan.providerPlanId,
            number: item.quantity,
            customOrderNo: `${order.orderNumber}-me-${item.id}`,
            notifyUrl,
          });
          await this.orderItemsService.update(item.id, {
            orderRequestId: topupId,
          });
          topupIds.push(topupId);
        } catch (err) {
          this.logger.error(
            `MicroEsim order failed for plan ${item.planId}: ${(err as Error).message}`,
          );
        }
      }

      this.microEsimService.scheduleCallbackAfterSubmit(topupIds);
    }

    // 8c. Call BILLION API — one F040 create-eSIM-order per BILLION order.
    // eSIMs are provisioned asynchronously: BILLION pushes the QR (N009) to our
    // webhook. Unlike MicroEsim there is no query that returns the QR/LPA, so
    // there is no poll fallback — we only record the wait (see BillionService).
    if (billionItems.length > 0) {
      let email = 'esimvietnam.api@gmail.com';
      if (order.userId) {
        const user = await this.usersService.findById(order.userId);
        if (user?.email) email = user.email;
      }

      const channelOrderId = `${order.orderNumber}-bl`;
      try {
        const result = await this.billionService.submitOrder({
          channelOrderId,
          email,
          subOrderList: billionItems.map((item) => {
            // A per-duration plan of a self-selected sku stores its copies in
            // the plan id ("skuId:7" = buy 7 days).
            const { skuId, copies } = parseBillionPlanId(
              item.plan.providerPlanId,
            );
            return {
              channelSubOrderId: `${order.orderNumber}-bl-${item.id}`,
              deviceSkuId: skuId,
              planSkuCopies: copies,
              number: item.quantity,
            };
          }),
        });

        // Every order-item in this BILLION order shares the main orderId, which
        // is how the N009 webhook (findByOrderRequestId) locates them.
        for (const item of billionItems) {
          await this.orderItemsService.update(item.id, {
            orderRequestId: result.orderId,
          });
        }
        this.billionService.scheduleCallbackAfterSubmit([result.orderId]);
      } catch (err) {
        this.logger.error(
          `BILLION order failed for order ${order.orderNumber}: ${(err as Error).message}`,
        );
      }
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

      // Batch fetch invoice existence, item counts and affiliate commissions
      const [invoiceOrderIds, itemCounts, productQuantities, commissions] =
        await Promise.all([
          this.invoiceRepository.findOrderIdsWithInvoice(orderIds),
          this.orderItemsService.countByOrderIds(orderIds),
          this.orderItemsService.sumQuantityByOrderIds(orderIds),
          // One query for the page, so the affiliate badge costs nothing
          // per row (#095).
          this.partnersService.getCommissionSummariesByOrderIds(orderIds),
        ]);

      const invoiceSet = new Set(invoiceOrderIds);
      for (const order of orders) {
        order.isInvoice = invoiceSet.has(order.id);
        order.itemCount = itemCounts.get(order.id) ?? 0;
        // What the customer counts: eSIMs, not order lines (#064).
        order.productQuantity = productQuantities.get(order.id) ?? 0;

        const commission = commissions.get(order.id);
        order.partnerCommission = commission
          ? {
              partnerId: commission.partnerId,
              partnerName: commission.partnerName,
              commissionVnd: commission.commissionVnd,
              commissionPercent: commissionShareOfOrder(
                commission.commissionVnd,
                order,
              ),
              status: commission.status,
            }
          : null;
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

    const [esims, plans, user, coupon, invoice, partnerCommission] =
      await Promise.all([
        this.esimsService.findByOrderItemIds(orderItems.map((i) => i.id)),
        Promise.all(
          orderItems.map((i) => this.plansService.findById(i.planId)),
        ),
        this.usersService.findById(order.userId),
        order.couponCode
          ? this.couponsService.findByCode(order.couponCode)
          : Promise.resolve(null),
        this.invoiceRepository.findByOrderId(order.id),
        // Who earned on this order and how much (#095).
        this.partnersService.getCommissionSummaryByOrderId(order.id),
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
      partnerCommission: partnerCommission
        ? {
            partnerId: partnerCommission.partnerId,
            partnerName: partnerCommission.partnerName,
            partnerStatus: partnerCommission.partnerStatus,
            linkCode: partnerCommission.linkCode,
            commissionVnd: partnerCommission.commissionVnd,
            commissionPercent: commissionShareOfOrder(
              partnerCommission.commissionVnd,
              order,
            ),
            status: partnerCommission.status,
            tierSnapshot: partnerCommission.tierSnapshot,
          }
        : null,
      discountAmount: order.discountAmount,
      couponDiscountVndAmount: order.couponDiscountVndAmount ?? 0,
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
                fupSpeed: plan.fupSpeed,
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
            invoicePhone: invoice.invoicePhone,
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
      ...(updateOrderDto.bankTransferCode !== undefined && {
        bankTransferCode: updateOrderDto.bankTransferCode,
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
      if (updatedOrder.attributedPartnerId) {
        try {
          await this.partnersService.creditCommissionForOrder(updatedOrder.id);
        } catch (err) {
          this.logger.error(
            `Failed to credit partner commission for order ${updatedOrder.id}: ${(err as Error).message}`,
          );
        }
      }
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

    // Per-item refund (#027): validate the selection belongs to this order
    // before touching any supplier, and cap the amount at what those items are
    // actually worth so a slip cannot refund more than was paid for them.
    let selectedItemIds: number[] | undefined;
    if (dto.orderItemIds?.length) {
      const orderItems = await this.orderItemsService.findByOrderId(order.id);
      const validIds = new Set(orderItems.map((item) => Number(item.id)));
      const unknown = dto.orderItemIds.filter((id) => !validIds.has(id));
      if (unknown.length) {
        throw new NotFoundException(
          `Order items ${unknown.join(', ')} do not belong to order ${order.id}`,
        );
      }

      selectedItemIds = dto.orderItemIds;

      const selectedValue = orderItems
        .filter((item) => selectedItemIds!.includes(Number(item.id)))
        .reduce((sum, item) => sum + Number(item.vndPrice ?? 0), 0);

      if (Number(dto.amountVnd) > selectedValue) {
        throw new UnprocessableEntityException(
          `Refund ${dto.amountVnd} exceeds the value of the selected items (${selectedValue})`,
        );
      }
    }

    // Cancel with suppliers before processing refund
    await this.cancelOrderWithSuppliers(order.id, selectedItemIds);

    const refund = await this.walletsService.refundOrder(order, dto, adminId);

    // Mark the refunded lines so they drop out of revenue/cost reporting and
    // the CMS can show which part of the order was given back. The overview
    // only counts items with status `completed`.
    if (selectedItemIds?.length) {
      for (const itemId of selectedItemIds) {
        try {
          await this.orderItemsService.update(itemId, {
            status: 'refunded',
          } as never);
        } catch (err) {
          this.logger.error(
            `refundOrder: failed to mark order item ${itemId} refunded: ${(err as Error).message}`,
          );
        }
      }
    }

    if (order.attributedPartnerId) {
      const totalOrderValue =
        Number(order.payableVndPrice ?? order.vndPrice ?? 0) +
        Number(order.walletSpentVndAmount ?? 0);
      const refundedAmountVnd =
        Number(order.refundedAmountVnd ?? 0) +
        Math.round(Number(dto.amountVnd));
      const isFullRefund = refundedAmountVnd >= totalOrderValue;
      try {
        await this.partnersService.reverseCommissionForOrder(order.id, {
          fullRefund: isFullRefund,
        });
      } catch (err) {
        this.logger.error(
          `refundOrder: failed to reverse partner commission for order ${order.id}: ${(err as Error).message}`,
        );
      }
    }

    return refund;
  }

  /**
   * Cancel order items with their respective suppliers.
   * - Airalo: skip (no cancel API)
   * - EsimAccess: call POST /api/v1/open/esim/cancel with esimTranNo from esim table
   * - Gadget Korea: call POST /api/v2/cancel/{orderRequestId} from order-item
   * - Viettel (local): clear userId and orderItemId in esim table
   */
  /**
   * Cancel with the suppliers behind an order.
   *
   * `onlyItemIds` limits it to part of the order (#027): an order can mix
   * suppliers, and refunding the esimaccess line must NOT cancel the airalo
   * line sitting next to it.
   */
  private async cancelOrderWithSuppliers(
    orderId: number,
    onlyItemIds?: number[],
  ): Promise<void> {
    const allItems = await this.orderItemsService.findByOrderId(orderId);
    const orderItems = onlyItemIds?.length
      ? allItems.filter((item) => onlyItemIds.includes(Number(item.id)))
      : allItems;

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
        } else if (item.plan.provider === 'microesim') {
          // Cancel microesim: terminate each eSIM by topup_id (orderRequestId)
          // + device_id (stored as esimTranNo).
          const esims = await this.esimsService.findByOrderItemIds([item.id]);
          for (const esim of esims) {
            if (item.orderRequestId && esim.esimTranNo) {
              await this.microEsimService.terminate(
                item.orderRequestId,
                esim.esimTranNo,
              );
            }
          }
        } else if (item.plan.provider === 'billion') {
          // Cancel billion: F008 cancels the whole order by orderId
          // (stored as orderRequestId). Best-effort inside the service.
          if (item.orderRequestId) {
            await this.billionService.cancelOrder(item.orderRequestId);
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

    if (order.attributedPartnerId) {
      try {
        await this.partnersService.reverseCommissionForOrder(order.id);
      } catch (err) {
        this.logger.error(
          `cancelOrder: failed to reverse pending partner commission for order ${order.id}: ${(err as Error).message}`,
        );
      }
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
    const failedOrderIds =
      await this.orderRepository.failExpiredPendingOrders(30);
    if (failedOrderIds.length > 0) {
      this.logger.log(
        `Auto-failed ${failedOrderIds.length} expired pending orders`,
      );
      for (const orderId of failedOrderIds) {
        try {
          await this.walletsService.releaseHoldForOrder(orderId);
        } catch (err) {
          this.logger.error(
            `failExpiredPendingOrders: failed to release hold for order ${orderId}: ${(err as Error).message}`,
          );
        }
        try {
          await this.walletsService.reversePendingReferralForOrder(orderId);
        } catch (err) {
          this.logger.error(
            `failExpiredPendingOrders: failed to reverse referral for order ${orderId}: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  /**
   * Soft-delete failed orders older than 1 week to free resources.
   * Runs daily at 3:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupFailedOrders(): Promise<void> {
    const deleted = await this.orderRepository.softDeleteByStatusOlderThan(
      'failed',
      7,
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
        thumbnailUrl: plan.destination.flagUrl ?? null,
      };
    }

    if (plan.region) {
      return {
        type: 'REGION',
        locationCode: null,
        slug: plan.region.slug,
        title: plan.region.title ?? null,
        titleVi: plan.region.titleVi ?? null,
        thumbnailUrl: plan.region.iconUrl ?? null,
      };
    }

    return null;
  }
}
