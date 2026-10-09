import { Esim } from '../esims/domain/esim';
import {
  allocateDiscount,
  netLineVnd,
  netUnitVnd,
  orderDiscountVnd,
  PricedLine,
  refundedCostVnd,
} from './order-refund-values';
import { OrderItem } from '../order-items/domain/order-item';
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
import { DataSource } from 'typeorm';
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
import {
  AdminOrderDetailDto,
  AdminOrderTopupDto,
} from './dto/admin-order-detail.dto';
import { CartsService } from '../carts/carts.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { ExchangeRateService } from '../plans/exchange-rate.service';
import { User } from '../users/domain/user';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { Plan } from '../plans/domain/plan';
import { WalletsService } from '../wallets/wallets.service';
import type { ReferralValidationResult } from '../wallets/wallets.service';
import { RefundOrderDto } from '../wallets/dto/admin-wallet.dto';
import { MembershipTierEnum, TierSourceEnum } from '../wallets/tier/tier.enum';
import { InvoiceRepository } from '../invoices/infrastructure/persistence/invoice.repository';
import { InvoiceStatus } from '../invoices/invoices.enum';
import { PartnersService } from '../partners/partners.service';
import { SessionShapeEnum } from '../partners/partners.enum';
import { generateOrderNumber } from '../utils/order-number';

const VND_ROUNDING_UNIT = 1000;

/**
 * What share of an order a commission came to (#095).
 *
 * The commission row stores dong, not a percentage — the rate can change per
 * tier and per campaign — so the figure an admin sees is worked out against
 * the money the order actually took, which is the number they are checking it
 * against anyway.
 */
/**
 * "Tỷ lệ trên giá trị đơn" of an affiliate commission (#014, test round 4).
 *
 * The rate the commission was set at wins when it was recorded. Otherwise it
 * is worked out against what the customer PAID (cash + eXU) — the value the
 * commission is calculated on. It used to divide by the list total before
 * the partner's coupon, so a 7% partner read "6.9%" on every discounted
 * order (44 240 ÷ 642 000 instead of ÷ 632 000).
 */
export function commissionShareOfOrder(
  earnedCommissionVnd: number,
  order: {
    vndPrice?: number | string | null;
    payableVndPrice?: number | string | null;
    walletSpentVndAmount?: number | string | null;
    subtotalVndPrice?: number | string | null;
  },
  percentSnapshot?: number | null,
): number {
  if (percentSnapshot != null && Number(percentSnapshot) > 0) {
    return Math.round(Number(percentSnapshot) * 10) / 10;
  }
  const paid =
    Number(order.payableVndPrice ?? order.vndPrice ?? 0) +
    Number(order.walletSpentVndAmount ?? 0);
  const base = paid > 0 ? paid : Number(order.subtotalVndPrice ?? 0);
  if (!(base > 0) || !(earnedCommissionVnd > 0)) return 0;
  return Math.round((earnedCommissionVnd / base) * 1000) / 10;
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

/**
 * Data and duration spelled out in a topup package code, e.g.
 * "change-plus-7days-3gb-topup" → { "3 GB", 7 } (#021).
 */
export function topupFromPackageCode(code: string): {
  dataText: string | null;
  durationDays: number | null;
} {
  const days = code.match(/(\d+)\s*days?\b/i);
  const data = code.match(/(\d+(?:\.\d+)?)\s*(gb|mb)\b/i);
  return {
    dataText: data ? `${data[1]} ${data[2].toUpperCase()}` : null,
    durationDays: days ? Number(days[1]) : null,
  };
}

/**
 * Expiry of a local eSIM from the day it is sold (#024, test round 4): a
 * Viettel travel eSIM of 15 days runs 15 days from the purchase — no
 * Vietnamese carrier reports activation, so buying it is starting it. A
 * domestic eSIM has no end ("Vô thời hạn"), so its expiry is cleared.
 */
export function localEsimExpiry(
  plan: { isDomesticEsim?: boolean | null; durationDays?: number | null },
  soldAt: Date = new Date(),
): { expiresAt: Date | null } | Record<string, never> {
  if (plan.isDomesticEsim) return { expiresAt: null };
  const days = Number(plan.durationDays ?? 0);
  if (!(days > 0)) return {};
  return { expiresAt: new Date(soldAt.getTime() + days * 24 * 60 * 60 * 1000) };
}

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
    private readonly exchangeRateService: ExchangeRateService,
    /**
     * Chỉ dùng để định giá lại dòng hàng của đơn đối tác (#046) — repository
     * của order_item không có `vndPrice` trong DTO cập nhật.
     */
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Resolve an optional KOL partner-link code (from checkout, sourced from the
   * `esim_partner_link` cookie set at /go/[code]) into partner attribution
   * fields for the new order. Independent of coupon/referral — a buyer can
   * have both a discount code AND arrive via a KOL link.
   *
   * `clickedAt` is when the buyer last opened the link. The partner only earns
   * on an order placed within the window of their tier (#037); the check itself
   * lives in `PartnersService.resolveLinkForAttribution`, which falls back to
   * the click log when the checkout sends no stamp.
   *
   * `partnerClickId` is the sturdier signal: an id the server minted at the
   * click and put in the redirect URL, so an iOS browser that dropped the
   * cookie still credits the partner (#039).
   */
  private async resolvePartnerAttribution(
    partnerLinkCode?: string | null,
    clickedAt?: string | null,
    couponCode?: string | null,
    buyerUserId?: number | null,
    partnerClickId?: string | null,
    ipHash?: string | null,
    userAgent?: string | null,
  ): Promise<{
    partnerLinkCode: string | null;
    attributedPartnerId: number | null;
    linkId: number | null;
  }> {
    // The precedence rules themselves (#033, #034, #035, #038) live in
    // PartnersService, where they can be read — and tested — in one piece.
    return this.partnersService.resolveOrderAttribution({
      linkCode: partnerLinkCode ?? null,
      clickedAt: clickedAt ?? null,
      clickId: partnerClickId ?? null,
      couponCode: couponCode ?? null,
      buyerUserId: buyerUserId ?? null,
      ipHash: ipHash ?? null,
      userAgent: userAgent ?? null,
    });
  }

  /**
   * Fraud-watch signals for an affiliate order (#036, #040).
   *
   * The order is never refused: the brief says it still earns the commission.
   * What it gets is a mark, so an admin reviewing a partner can see that these
   * orders came from one device or one network rather than from an audience.
   */
  private async resolveFraudSignals(
    attributedPartnerId: number | null,
    visitorId: string | null,
    ipHash: string | null,
    clickId?: string | null,
  ): Promise<{
    visitorId: string | null;
    ipHash: string | null;
    warning: string | null;
  }> {
    if (!attributedPartnerId) {
      return { visitorId, ipHash, warning: null };
    }

    const warnings: string[] = [];

    if (visitorId || ipHash) {
      const seenBefore = await this.partnersService.hasOrderFromSameOrigin(
        attributedPartnerId,
        visitorId,
        ipHash,
      );
      if (seenBefore) warnings.push('same_device_or_ip');
    }

    // What the session looked like on the way here (#040): an order that never
    // opened a plan, or opened twenty in ten seconds, is worth a look.
    const shape = await this.partnersService.evaluateSessionShape({
      visitorId,
      clickId,
    });
    if (shape && shape !== SessionShapeEnum.NATURAL) warnings.push(shape);

    return {
      visitorId,
      ipHash,
      warning: warnings.length ? warnings.join(',') : null,
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
        // Top-ups earn no commission (#025).
        orderType: order.orderType,
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

  async submitOrder(
    userId: number,
    dto: SubmitOrderDto,
    /** Hashed network address of the buyer, for fraud watching (#036). */
    clientIpHash?: string | null,
    /** The buyer's user agent, for the device backstop in #039. */
    clientUserAgent?: string | null,
  ): Promise<Order> {
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
      pricing.couponCode,
      userId,
      dto.partnerClickId,
      clientIpHash,
      clientUserAgent,
    );

    // Same device or network as another order for this partner still earns the
    // commission, but is flagged for review (#036).
    const fraudSignals = await this.resolveFraudSignals(
      attribution.attributedPartnerId,
      dto.visitorId ?? null,
      clientIpHash ?? null,
      dto.partnerClickId ?? null,
    );

    // 3. Create order
    const orderNumber = generateOrderNumber();
    const order = await this.orderRepository.create({
      userId,
      orderNumber,
      status: 'pending',
      totalAmount: pricing.finalAmount,
      // `totalAmount` is always dollars (#017): a VND plan's currency here
      // labelled a dollar figure as đồng on manual / partner orders.
      currency: 'USD',
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
      buyerIpHash: fraudSignals.ipHash,
      buyerVisitorId: fraudSignals.visitorId,
      attributionWarning: fraudSignals.warning,
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
      const txnId = `${orderNumber}-esimaccess`;

      let esimAccessOrderNo: string | null = null;
      try {
        const result = await this.esimAccessService.submitPlanOrder({
          transactionId: txnId,
          // Day passes are charged for every day bought (#013, round 4).
          lines: esimAccessItems.map((i) => ({
            packageCode: i.plan.providerPlanId,
            count: i.quantity,
            unitPriceUsd: Number(i.plan.costPrice),
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
            ...localEsimExpiry(item.plan),
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
    /** Hashed network address of the buyer, for fraud watching (#036). */
    clientIpHash?: string | null,
    /** The buyer's user agent, for the device backstop in #039. */
    clientUserAgent?: string | null,
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
      pricing.couponCode,
      userId,
      dto.partnerClickId,
      clientIpHash,
      clientUserAgent,
    );

    // Same device and network as another order for this partner still earns
    // the commission, but is flagged for an admin to look at (#036).
    const fraudSignals = await this.resolveFraudSignals(
      attribution.attributedPartnerId,
      dto.visitorId ?? null,
      clientIpHash ?? null,
      dto.partnerClickId ?? null,
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
      // `totalAmount` is always dollars (#017): a VND plan's currency here
      // labelled a dollar figure as đồng on manual / partner orders.
      currency: 'USD',
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
      buyerIpHash: fraudSignals.ipHash,
      buyerVisitorId: fraudSignals.visitorId,
      attributionWarning: fraudSignals.warning,
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
            currency: 'USD',
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
        // `price` is dollars for every plan, local ones included (#017).
        currency: 'USD',
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
    // totalAmount in USD, local inventory included (#017, test round 4): its
    // dollar price comes from `usdPrice`, which the exchange-rate job keeps up
    // for every plan. Leaving those lines out put a Viettel-only order at $0
    // and short-changed the total of every mixed order.
    const totalAmount = planDetails.reduce(
      (sum, item) =>
        sum + getPlanUsdPrice(item.plan, item.periodNum) * item.quantity,
      0,
    );
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
  async retryProvisioning(
    orderId: number,
    options: { itemIds?: number[] } = {},
  ): Promise<{
    retriedItemIds: number[];
    skippedItemIds: number[];
    emailsSent: number;
    message: string;
  }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (order.status !== 'paid') {
      throw new UnprocessableEntityException(
        `Order ${order.orderNumber} is ${order.status}; only a paid order can be re-sent to the supplier`,
      );
    }

    const allItems = await this.orderItemsService.findByOrderId(orderId);

    // An explicit selection from the picker (#014) narrows WHICH lines are
    // considered — it never overrides the eligibility rules below, so ticking a
    // line that already has an eSIM still cannot buy a second one.
    const chosen = options.itemIds?.length
      ? new Set(options.itemIds.map(Number))
      : null;
    if (chosen) {
      const known = new Set(allItems.map((item) => Number(item.id)));
      const unknown = [...chosen].filter((id) => !known.has(id));
      if (unknown.length) {
        throw new UnprocessableEntityException(
          `Order ${order.orderNumber} has no item(s) ${unknown.join(', ')}`,
        );
      }
    }
    const items = chosen
      ? allItems.filter((item) => chosen.has(Number(item.id)))
      : allItems;

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
        emailsSent: 0,
        message:
          'Không có sản phẩm nào cần gọi lại: tất cả đã có eSIM hoặc đã được nhà cung cấp tiếp nhận.',
      };
    }

    this.logger.log(
      `retryProvisioning: re-submitting items ${retriedItemIds.join(', ')} of order ${order.orderNumber}`,
    );

    // Muted: the mail goes out ONCE, just below. `submitProviders` mails the
    // local-stock eSIMs it assigns on its own, so the retry used to send every
    // Viettel eSIM twice — "2 eSIMs re-sent, 4 in the email" (#020, round 4).
    await this.submitProviders(orderId, {
      onlyItemIds: retriedItemIds,
      mutedEmail: true,
    });

    // Mail whatever came back on this run (#014). Suppliers that deliver over a
    // webhook (Airalo, Billion, MicroEsim) have nothing yet, and their webhook
    // sends the email itself when the eSIM lands — so 0 here is a normal
    // outcome, not a failure.
    let emailsSent = 0;
    try {
      const mailed = await this.resendEsimEmail(orderId, {
        onlyOrderItemIds: retriedItemIds,
      });
      emailsSent = mailed.sent;
    } catch (err) {
      // The supplier call already succeeded; a mail failure must not turn that
      // into an error the admin reads as "the retry did not work".
      this.logger.error(
        `retryProvisioning: re-order succeeded but email failed for order ${order.orderNumber}: ${(err as Error).message}`,
      );
    }

    const emailNote =
      emailsSent > 0
        ? ` Đã gửi lại email eSIM (${emailsSent} eSIM).`
        : ' Nhà cung cấp giao bất đồng bộ nên eSIM chưa về; email sẽ tự gửi khi eSIM về.';

    return {
      retriedItemIds,
      skippedItemIds,
      emailsSent,
      message: `Đã gọi lại nhà cung cấp cho ${retriedItemIds.length} sản phẩm.${emailNote}`,
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
      const txnId = `${order.orderNumber}-esimaccess`;
      try {
        const result = await this.esimAccessService.submitPlanOrder({
          transactionId: txnId,
          // Day passes are charged for every day bought (#013, round 4).
          lines: esimAccessItems.map((i) => ({
            packageCode: i.plan.providerPlanId,
            count: i.quantity,
            unitPriceUsd: Number(i.plan.costPrice),
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
      // Never the customer's address: BILLION emails the eSIM to it, which
      // gave away the supplier. We email the customer ourselves (v3 #002).
      const email = this.billionService.orderEmail;

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
            ...localEsimExpiry(item.plan),
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
    dto: {
      email: string;
      packageCode: string;
      slug: string;
      quantity: number;
      customerName?: string | null;
    },
  ): Promise<Order> {
    // 1. Resolve plan by slug (primary) and verify packageCode.
    //
    // Before the buyer, because resolving the buyer now has a side effect: it
    // creates the account (#041). A bad plan must not leave a stray account
    // behind for an order that never happened.
    const plan = await this.plansService.findBySlug(dto.slug);
    if (!plan) {
      throw new NotFoundException(`Plan slug ${dto.slug} not found`);
    }
    if (plan.providerPlanId !== dto.packageCode) {
      throw new BadRequestException(
        `Plan slug ${dto.slug} does not match packageCode ${dto.packageCode} (expected ${plan.providerPlanId})`,
      );
    }

    // 2. Resolve the buyer, creating the account when there is none (#041).
    //
    // The whole point of đặt đơn hộ is that the customer does not want to touch
    // the website, so refusing an unknown email meant telling them to go and
    // register first — the errand the feature exists to remove.
    const buyer =
      (await this.usersService.findByEmail(dto.email)) ??
      (await this.createBuyerForManualOrder(
        adminUserId,
        dto.email,
        dto.customerName ?? null,
      ));

    // 3. Build a SubmitOrderDto-compatible payload (no coupon/wallet/referral for manual orders)
    const submitDto: SubmitOrderDto = {
      currency: plan.currency,
      items: [{ planId: plan.id, quantity: dto.quantity }],
      paymentMethod: 'admin_manual',
    };

    // 4. Create the pending order at the real USD→VND rate.
    //
    // This used to pass no rate at all, on the reasoning that "cost figures are
    // not critical for an admin-bypassed order". They are: with no rate,
    // `createPendingOrder` stores `vndCostPrice = 0` on the order and on every
    // item, so an đặt đơn hộ order showed no giá vốn on its detail page and
    // contributed nothing to the margin on the overview — it looked like pure
    // profit (#042). The rate is cached for an hour and never throws, so there
    // is no FX call to avoid.
    const vndRate = await this.exchangeRateService.getUsdToVndRate();
    const orderNumber = `MAN-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
    const order = await this.createPendingOrder(
      Number(buyer.id),
      submitDto,
      orderNumber,
      vndRate,
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
   * Đối tác phân phối tự đặt mua hàng bằng ví ký quỹ (#046).
   *
   * Giống `submitManualOrder` ở chỗ không đi qua cổng thanh toán, khác ở ba
   * điểm quan trọng:
   *
   * 1. Đơn được **định giá lại** theo giá vốn + markup hạng của đối tác. Giữ
   *    nguyên giá bán lẻ sẽ cộng vào doanh thu esim.vn một khoản chưa ai trả.
   * 2. Ví bị trừ **trước** khi gọi nhà cung cấp, qua `onDebit`. Trừ sau thì có
   *    lúc đối tác đã cầm eSIM mà ví không còn đủ tiền để trừ. `onDebit` ném
   *    lỗi thì đơn dừng ở `pending` và không có eSIM nào được cấp.
   * 3. **Không gửi email eSIM**: chốt 02/10/2026, đối tác nhận hàng bằng file
   *    Excel tải về. Gửi hàng trăm email cho một lần mua 100 cái là spam chính
   *    hộp thư của đối tác.
   */
  async submitPartnerPurchase(input: {
    buyerUserId: number;
    planId: number;
    quantity: number;
    unitPriceVnd: number;
    onDebit: (orderId: number, orderNumber: string) => Promise<void>;
  }): Promise<Order> {
    const plan = await this.plansService.findById(input.planId);
    if (!plan) {
      throw new NotFoundException(`Plan ${input.planId} not found`);
    }
    if (!plan.isActive) {
      throw new BadRequestException(
        `Plan ${input.planId} is no longer on sale`,
      );
    }

    const vndRate = await this.exchangeRateService.getUsdToVndRate();
    const orderNumber = `PTN-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    const order = await this.createPendingOrder(
      input.buyerUserId,
      {
        currency: plan.currency,
        items: [{ planId: plan.id, quantity: input.quantity }],
        paymentMethod: 'partner_wallet',
      } as SubmitOrderDto,
      orderNumber,
      vndRate,
    );

    // Định giá lại theo giá đối tác. `createPendingOrder` tính theo giá bán lẻ
    // vì nó dùng chung với giỏ hàng của khách; ở đây số tiền thật là số tiền
    // trừ khỏi ví, nên mọi cột doanh thu của đơn phải mang đúng số đó.
    const totalVnd = input.unitPriceVnd * input.quantity;
    await this.orderRepository.update(order.id, {
      // The dollar total follows the repriced đồng figure (#017).
      totalAmount:
        vndRate > 0 ? Math.round((totalVnd / vndRate) * 100) / 100 : 0,
      currency: 'USD',
      vndPrice: totalVnd,
      subtotalVndPrice: totalVnd,
      payableVndPrice: totalVnd,
      eligibleSpendVnd: totalVnd,
      discountAmount: 0,
      couponDiscountVndAmount: 0,
    } as Partial<Order>);
    await this.dataSource.query(
      `UPDATE order_item SET "vndPrice" = $1 WHERE "orderId" = $2`,
      [input.unitPriceVnd, order.id],
    );

    // Trừ ví trước khi có bất kỳ eSIM nào tồn tại. Không bọc try/catch: ví
    // thiếu tiền thì đơn phải dừng lại ở đây, không được cấp hàng.
    await input.onDebit(order.id, orderNumber);

    await this.finalizePaidOrder(order.id, {
      paymentMethod: 'partner_wallet',
      paymentId: `PARTNER-${input.buyerUserId}`,
      mutedEmail: true,
    });

    try {
      await this.submitProviders(order.id, { mutedEmail: true });
    } catch (err) {
      // Nuốt lỗi ở đây để trả đơn về cho phía gọi đếm số eSIM thực cấp và
      // quyết định hoàn tiền — ném ra sẽ giấu mất đơn vừa bị trừ tiền.
      this.logger.error(
        `submitPartnerPurchase: provider submission failed for ${orderNumber}: ${(err as Error).message}`,
      );
    }

    const finalOrder = await this.orderRepository.findById(order.id);
    return finalOrder ?? order;
  }

  /**
   * Create the buyer's account so an đặt đơn hộ order has an owner (#041).
   *
   * Deliberately WITHOUT a password. The customer asked staff to order for them
   * precisely because they did not want to deal with the website, so minting a
   * temporary password and emailing it would put the errand back — and an
   * unsolicited credentials email to someone who never signed up is worse than
   * no email. The account is otherwise a normal customer account: the eSIM is
   * delivered to this address, the order shows up under it, and if they ever do
   * want to sign in, "quên mật khẩu" sets a password the usual way.
   *
   * The name is whatever the admin typed; blank leaves it null rather than
   * guessing one from the email address.
   */
  private async createBuyerForManualOrder(
    adminUserId: number,
    email: string,
    customerName: string | null,
  ): Promise<User> {
    const name = customerName?.trim() || null;

    const buyer = await this.usersService.create({
      email,
      firstName: name,
      lastName: null,
      role: { id: RoleEnum.user },
      status: { id: StatusEnum.active },
    } as CreateUserDto);

    this.logger.log(
      `submitManualOrder: admin ${adminUserId} created account ${buyer.id} for ${email} (no password set)`,
    );

    return buyer;
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
  async resendEsimEmail(
    orderId: number,
    options: { onlyOrderItemIds?: number[] } = {},
  ): Promise<{
    sent: number;
    skippedReason?: string;
  }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const buyer = await this.usersService.findById(order.userId);
    if (!buyer?.email) {
      return { sent: 0, skippedReason: 'buyer-has-no-email' };
    }

    const allItems = await this.orderItemsService.findByOrderId(orderId);
    if (!allItems.length) {
      return { sent: 0, skippedReason: 'no-order-items' };
    }

    // The retry button mails only the lines it just re-ordered (#014): mailing
    // the whole order would send the customer a second copy of every eSIM they
    // already had.
    const orderItems = options.onlyOrderItemIds?.length
      ? allItems.filter((item) =>
          options.onlyOrderItemIds!.includes(Number(item.id)),
        )
      : allItems;

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
          callMinutes: plan?.call ?? null,
          smsCount: plan?.sms ?? null,
          planData: plan ?? null,
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
    // `call` / `sms` so the email can state the allowance (#023).
    localItems: Array<{
      planId: number;
      plan: {
        name: string;
        call?: number | null;
        sms?: number | null;
        dataMb?: number | null;
        durationDays?: number | null;
        type?: string | null;
      };
    }>,
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
          callMinutes: plan?.plan.call ?? null,
          smsCount: plan?.plan.sms ?? null,
          planData: plan?.plan ?? null,
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
                commission.commissionVnd +
                  (commission.reversedCommissionVnd ?? 0),
                order,
                commission.commissionPercentSnapshot,
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

  /**
   * The topup half of an order detail (#015): what the package gave, and the
   * eSIM it was applied to so the result can be reconciled.
   *
   * The package details come from the snapshot stored at checkout, never from a
   * fresh provider lookup — a catalogue that has moved on must not rewrite
   * history on a past order.
   */
  /**
   * Topups placed before the package snapshot existed (22/09/2026) have no
   * package name, data, duration, and a cost of 0đ (#021, test round 4).
   * Airalo still lists the package for the eSIM, so the snapshot is read back
   * from it once and stored on the order; failing that, what the package code
   * itself says ("change-plus-7days-3gb-topup" → 3 GB, 7 days) is used.
   * Mutates `order` so the page shows the figures on this very request.
   */
  private async healTopupSnapshot(order: Order): Promise<void> {
    const missingSnapshot = !order.topupPackageName;
    const missingCost = !(Number(order.vndCostPrice) > 0);
    if (!missingSnapshot && !missingCost) return;

    const patch: Partial<Order> = {};
    if (
      order.topupProvider?.toUpperCase() === 'AIRALO' &&
      order.targetIccid &&
      order.topupPackageId
    ) {
      try {
        const packages = await this.airaloService.listTopupPackages(
          order.targetIccid,
        );
        const pkg = packages.find((p) => p.id === order.topupPackageId);
        if (pkg) {
          if (missingSnapshot) {
            patch.topupPackageName = pkg.title ?? null;
            patch.topupDataText = pkg.data ?? null;
            patch.topupDurationDays = pkg.day ?? null;
            patch.topupIsUnlimited = !!pkg.is_unlimited;
          }
          if (missingCost && Number(pkg.net_price) > 0) {
            const rate = await this.exchangeRateService.getUsdToVndRate();
            patch.vndCostPrice = roundVndToThousands(
              Number(pkg.net_price) * rate,
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `healTopupSnapshot: Airalo lookup failed for ${order.orderNumber}: ${(err as Error).message}`,
        );
      }
    }

    if (missingSnapshot && !patch.topupPackageName && order.topupPackageId) {
      const parsed = topupFromPackageCode(order.topupPackageId);
      if (parsed.dataText || parsed.durationDays) {
        patch.topupDataText = parsed.dataText;
        patch.topupDurationDays = parsed.durationDays;
        patch.topupPackageName = [
          parsed.dataText,
          parsed.durationDays ? `${parsed.durationDays} days` : null,
        ]
          .filter(Boolean)
          .join(' - ');
      }
    }

    if (Object.keys(patch).length === 0) return;
    Object.assign(order, patch);
    try {
      await this.orderRepository.update(order.id, patch);
    } catch (err) {
      this.logger.warn(
        `healTopupSnapshot: could not store the snapshot of ${order.orderNumber}: ${(err as Error).message}`,
      );
    }
  }

  private async buildTopupDetail(
    order: Order,
  ): Promise<AdminOrderTopupDto | null> {
    if (order.orderType !== 'TOPUP' || !order.targetIccid) return null;

    const esim = await this.esimsService.findByIccid(order.targetIccid);
    let planName: string | null = null;
    if (esim?.planId != null) {
      const plan = await this.plansService.findById(esim.planId);
      planName = plan?.name ?? null;
    }

    // The order the eSIM came from, so an admin can jump back to the purchase
    // — shown by its order number, not its id (#021, test round 4).
    let originalOrderId: number | null = null;
    let originalOrderNumber: string | null = null;
    if (esim?.orderItemId != null) {
      const orderItem = await this.orderItemsService.findById(esim.orderItemId);
      originalOrderId =
        orderItem?.orderId != null ? Number(orderItem.orderId) : null;
      if (originalOrderId != null) {
        const original = await this.orderRepository.findById(originalOrderId);
        originalOrderNumber = original?.orderNumber ?? null;
      }
    }

    await this.healTopupSnapshot(order);

    return {
      targetIccid: order.targetIccid,
      provider: order.topupProvider ?? null,
      packageId: order.topupPackageId ?? null,
      packageName: order.topupPackageName ?? null,
      dataText: order.topupDataText ?? null,
      durationDays: order.topupDurationDays ?? null,
      isUnlimited: !!order.topupIsUnlimited,
      targetEsim: esim
        ? {
            id: esim.id,
            iccid: esim.iccid,
            status: esim.status,
            provider: esim.provider ?? null,
            planName,
            dataUsed: esim.dataUsed ?? null,
            dataTotal: esim.dataTotal ?? null,
            expiresAt: esim.expiresAt ?? null,
            activatedAt: esim.activatedAt ?? null,
            originalOrderId,
            originalOrderNumber,
          }
        : null,
    };
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

    const topup = await this.buildTopupDetail(order);

    // Money before / after refunds (#009, round 4), and each line's share of
    // the discount, which is what refunding that line pays back.
    const shares = allocateDiscount(
      orderItems as PricedLine[],
      orderDiscountVnd(order),
    );
    const refundTotals = await this.walletsService.getRefundTotalsByOrderId(
      order.id,
    );
    const originalOrderValueVnd =
      Number(order.payableVndPrice ?? order.vndPrice ?? 0) +
      Number(order.walletSpentVndAmount ?? 0);
    const refundedVnd = Number(order.refundedAmountVnd ?? 0);
    const orderValueVnd = Math.max(originalOrderValueVnd - refundedVnd, 0);
    const originalVndCostPrice = Number(order.vndCostPrice ?? 0);
    const originalTotalAmount = Number(order.totalAmount ?? 0);
    const afterRefund = {
      originalOrderValueVnd,
      orderValueVnd,
      originalVndCostPrice,
      vndCostPrice: Math.max(
        originalVndCostPrice -
          refundedCostVnd(orderItems as PricedLine[], esims),
        0,
      ),
      originalTotalAmount,
      totalAmount:
        originalOrderValueVnd > 0
          ? Math.round(
              (originalTotalAmount * orderValueVnd * 100) /
                originalOrderValueVnd,
            ) / 100
          : originalTotalAmount,
      refundedVnd,
      refundedToWalletVnd: refundTotals.walletVnd,
      refundedDirectVnd: refundTotals.directVnd,
      originalCashbackVnd: Number(order.cashbackAmountVnd ?? 0),
      cashbackVnd: Math.max(
        Number(order.cashbackAmountVnd ?? 0) - refundTotals.cashbackReversedVnd,
        0,
      ),
      originalCommissionVnd: partnerCommission
        ? partnerCommission.commissionVnd +
          (partnerCommission.reversedCommissionVnd ?? 0)
        : null,
      commissionVnd: partnerCommission?.commissionVnd ?? null,
    };

    return {
      id: order.id,
      subtotalVndPrice: Number(order.subtotalVndPrice ?? 0),
      payableVndPrice: Number(order.payableVndPrice ?? 0),
      refundedAmountVnd: refundedVnd,
      refundStatus: order.refundStatus ?? null,
      afterRefund,
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
      orderType: order.orderType ?? 'BUY_NEW',
      topup,
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
            // Against what was earned, so a partial refund does not make the
            // rate look lower than the partner's tier (#014).
            commissionPercent: commissionShareOfOrder(
              partnerCommission.commissionVnd +
                (partnerCommission.reversedCommissionVnd ?? 0),
              order,
              partnerCommission.commissionPercentSnapshot,
            ),
            status: partnerCommission.status,
            rejectionReason: partnerCommission.rejectionReason,
            tierSnapshot: partnerCommission.tierSnapshot,
          }
        : null,
      attributionWarning: order.attributionWarning ?? null,
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
                call: plan.call ?? null,
                sms: plan.sms ?? null,
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
          discountShareVnd: shares.get(Number(item.id)) ?? 0,
          netVndPrice: netLineVnd(
            item as PricedLine,
            shares.get(Number(item.id)) ?? 0,
          ),
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

    // Per-item refund (#027) and per-eSIM refund (#008, round 4): validate the
    // selection belongs to this order before touching any supplier, and cap the
    // amount at what it is actually worth so a slip cannot refund more than was
    // paid for it.
    const isPartial = !!(dto.orderItemIds?.length || dto.esimIds?.length);
    let selectedItemIds: number[] = [];
    let selectedEsims: Esim[] = [];
    let orderItems: OrderItem[] = [];
    if (isPartial) {
      orderItems = await this.orderItemsService.findByOrderId(order.id);
      const validIds = new Set(orderItems.map((item) => Number(item.id)));
      const unknown = (dto.orderItemIds ?? []).filter(
        (id) => !validIds.has(id),
      );
      if (unknown.length) {
        throw new NotFoundException(
          `Order items ${unknown.join(', ')} do not belong to order ${order.id}`,
        );
      }
      selectedItemIds = dto.orderItemIds ?? [];

      if (dto.esimIds?.length) {
        const orderEsims = await this.esimsService.findByOrderItemIds([
          ...validIds,
        ]);
        const byId = new Map(orderEsims.map((esim) => [Number(esim.id), esim]));
        const unknownEsims = dto.esimIds.filter((id) => !byId.has(id));
        if (unknownEsims.length) {
          throw new NotFoundException(
            `eSIMs ${unknownEsims.join(', ')} do not belong to order ${order.id}`,
          );
        }
        const picked = dto.esimIds.map((id) => byId.get(id)!);
        const done = picked.filter((esim) => esim.status === 'refunded');
        if (done.length) {
          throw new UnprocessableEntityException(
            `eSIMs ${done.map((e) => e.iccid).join(', ')} were already refunded`,
          );
        }
        // An eSIM of a line refunded whole is already covered by that line.
        selectedEsims = picked.filter(
          (esim) => !selectedItemIds.includes(Number(esim.orderItemId)),
        );
      }

      // Valued AFTER the order's discount, shared over the lines by price
      // (#009, round 4): at list price, refunding every line one by one paid
      // the whole coupon back on top of what the customer had paid.
      const itemById = new Map(orderItems.map((i) => [Number(i.id), i]));
      const shares = allocateDiscount(
        orderItems as PricedLine[],
        orderDiscountVnd(order),
      );
      const shareOf = (itemId: number) => shares.get(itemId) ?? 0;
      const selectedValue =
        orderItems
          .filter((item) => selectedItemIds.includes(Number(item.id)))
          .reduce(
            (sum, item) =>
              sum + netLineVnd(item as PricedLine, shareOf(Number(item.id))),
            0,
          ) +
        selectedEsims.reduce((sum, esim) => {
          const line = itemById.get(Number(esim.orderItemId));
          return line
            ? sum + netUnitVnd(line as PricedLine, shareOf(Number(line.id)))
            : sum;
        }, 0);

      if (Number(dto.amountVnd) > selectedValue) {
        throw new UnprocessableEntityException(
          `Refund ${dto.amountVnd} exceeds the value of the selected items (${selectedValue})`,
        );
      }
    }

    // Cancel with suppliers before processing refund. A supplier refusing does
    // not stop the refund — the customer is owed it either way — but the admin
    // is told, so they can chase the supplier for our money (v3 #002).
    // Only ICCIDs picked = no whole line to cancel; an empty list must NOT fall
    // through to "the whole order".
    const supplierWarnings: string[] =
      !isPartial || selectedItemIds.length
        ? ((await this.cancelOrderWithSuppliers(
            order.id,
            isPartial ? selectedItemIds : undefined,
          )) ?? [])
        : [];
    if (selectedEsims.length) {
      supplierWarnings.push(
        ...(await this.cancelEsimsWithSuppliers(selectedEsims, orderItems)),
      );
    }

    const refund = await this.walletsService.refundOrder(order, dto, adminId);

    // Mark the refunded lines so they drop out of revenue/cost reporting and
    // the CMS can show which part of the order was given back. The overview
    // only counts items with status `completed`.
    for (const itemId of selectedItemIds) {
      await this.markItemRefunded(itemId);
    }

    if (!isPartial || selectedItemIds.length) {
      await this.markRefundedEsims(
        order.id,
        isPartial ? selectedItemIds : undefined,
      );
    }

    // Single eSIMs: refunded one by one; their line follows once every eSIM
    // of it has been given back.
    if (selectedEsims.length) {
      for (const esim of selectedEsims) {
        try {
          await this.esimsService.update(esim.id, { status: 'refunded' });
        } catch (err) {
          this.logger.error(
            `refundOrder: failed to mark esim ${esim.id} refunded: ${(err as Error).message}`,
          );
        }
      }
      const touchedItems = [
        ...new Set(selectedEsims.map((e) => Number(e.orderItemId))),
      ];
      const after = await this.esimsService.findByOrderItemIds(touchedItems);
      for (const itemId of touchedItems) {
        const lineEsims = after.filter((e) => Number(e.orderItemId) === itemId);
        if (
          lineEsims.length &&
          lineEsims.every((e) => e.status === 'refunded')
        ) {
          await this.markItemRefunded(itemId);
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
        if (isFullRefund) {
          await this.partnersService.reverseCommissionForOrder(order.id, {
            fullRefund: true,
          });
        } else {
          // Only the refunded products lose their commission (#018); the rest
          // of the order still earned it.
          await this.partnersService.adjustCommissionForPartialRefund({
            orderId: order.id,
            refundedAmountVnd,
            orderValueVnd: totalOrderValue,
          });
        }
      } catch (err) {
        this.logger.error(
          `refundOrder: failed to reverse partner commission for order ${order.id}: ${(err as Error).message}`,
        );
      }
    }

    return { ...refund, supplierWarnings };
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
  /**
   * Put the refunded eSIMs into `refunded` status (#019).
   *
   * `cancelOrderWithSuppliers` only did this for local inventory, so an eSIM from
   * esimaccess / airalo / gadgetkorea / microesim / billion stayed `sold` after a
   * refund and the eSIM list showed it as a live eSIM. It is done here rather
   * than in the supplier loop because it is bookkeeping, not a supplier call: the
   * money has been given back whether or not the supplier's cancel API answered.
   *
   * `resolveDeliveredStatus` never overwrites `refunded`, so a late provider
   * callback cannot resurrect one of these.
   */
  private async markRefundedEsims(
    orderId: number,
    onlyItemIds?: number[],
  ): Promise<void> {
    const allItems = await this.orderItemsService.findByOrderId(orderId);
    const itemIds = (
      onlyItemIds?.length
        ? allItems.filter((item) => onlyItemIds.includes(Number(item.id)))
        : allItems
    ).map((item) => Number(item.id));
    if (itemIds.length === 0) return;

    const esims = await this.esimsService.findByOrderItemIds(itemIds);
    for (const esim of esims) {
      if (esim.status === 'refunded') continue;
      try {
        await this.esimsService.update(esim.id, { status: 'refunded' });
      } catch (err) {
        this.logger.error(
          `refundOrder: failed to mark esim ${esim.id} refunded: ${(err as Error).message}`,
        );
      }
    }
  }

  private async markItemRefunded(itemId: number): Promise<void> {
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

  /**
   * Cancel single eSIMs of a line with their supplier (#008, round 4).
   * esimaccess and MicroEsim cancel per eSIM and local stock is released;
   * Billion and Gadget Korea only cancel a whole supplier order and Airalo
   * cannot cancel at all, so for those the admin is told to settle the spare
   * ICCID with the supplier by hand.
   *
   * @returns one line per eSIM the supplier did not cancel, for the admin.
   */
  private async cancelEsimsWithSuppliers(
    esims: Esim[],
    orderItems: OrderItem[],
  ): Promise<string[]> {
    const warnings: string[] = [];
    const itemById = new Map(orderItems.map((i) => [Number(i.id), i]));
    for (const esim of esims) {
      const item = itemById.get(Number(esim.orderItemId));
      const plan = item ? await this.plansService.findById(item.planId) : null;
      if (!plan) continue;
      const label = `ICCID ${esim.iccid} (${plan.provider})`;
      try {
        if (plan.provider === 'esimaccess') {
          if (esim.esimTranNo) {
            await this.esimAccessService.cancelEsim(esim.esimTranNo);
          }
        } else if (plan.provider === 'microesim') {
          if (item?.orderRequestId && esim.esimTranNo) {
            await this.microEsimService.terminate(
              item.orderRequestId,
              esim.esimTranNo,
            );
          }
        } else if (plan.isLocalInventory) {
          await this.esimsService.update(esim.id, {
            userId: null,
            orderItemId: null,
            status: 'refunded',
          });
        } else {
          warnings.push(
            `${label}: nhà cung cấp không hủy được riêng 1 eSIM — cần liên hệ nhà cung cấp để hoàn eSIM này`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Failed to cancel esim ${esim.id} with provider ${plan.provider}: ${(err as Error).message}`,
        );
        warnings.push(
          `${label}: nhà cung cấp chưa hủy — ${(err as Error).message}`,
        );
      }
    }
    return warnings;
  }

  /** @returns one line per supplier that did not cancel, for the admin. */
  private async cancelOrderWithSuppliers(
    orderId: number,
    onlyItemIds?: number[],
  ): Promise<string[]> {
    const warnings: string[] = [];
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
        warnings.push(
          `${item.plan.name ?? `Sản phẩm #${item.id}`} (${item.plan.provider}): nhà cung cấp chưa hủy — ${(err as Error).message}`,
        );
      }
    }
    return warnings;
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
        // A cancelled order is void in full, so a commission already credited
        // is clawed back too — into a negative balance if need be (#007).
        await this.partnersService.reverseCommissionForOrder(order.id, {
          cancelled: true,
        });
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
