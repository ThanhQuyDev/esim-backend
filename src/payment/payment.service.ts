import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnepayService } from './onepay.service';
import { OrdersService } from '../orders/orders.service';
import { AllConfigType } from '../config/config.type';
import { SubmitOrderDto } from '../orders/dto/submit-order.dto';
import { CustomPaymentLinksService } from '../custom-payment-links/custom-payment-links.service';
import { CUSTOM_PAYMENT_VIRTUAL_ORDER_PREFIX } from '../custom-payment-links/custom-payment-links.enum';
import { TopupService } from '../topup/topup.service';
import {
  TOPUP_ORDER_NUMBER_PREFIX,
  TOPUP_ORDER_STATUS,
} from '../topup/topup.constants';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly onepayService: OnepayService,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly customPaymentLinksService: CustomPaymentLinksService,
    private readonly topupService: TopupService,
  ) {}

  async createCheckout(
    userId: number,
    dto: SubmitOrderDto,
    clientIp: string,
  ): Promise<{ paymentUrl: string; orderNumber: string }> {
    const rate = await this.fetchVndRate();
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const order = await this.ordersService.createPendingOrder(
      userId,
      dto,
      orderNumber,
      rate,
    );

    // If eXU wallet covers the entire amount, skip OnePay and finalize immediately
    if (order.vndPrice <= 0) {
      await this.ordersService.finalizePaidOrder(order.id, {
        paymentMethod: 'wallet',
        paymentId: null,
      });
      await this.ordersService.submitProviders(order.id);
      if (order.couponCode) {
        await this.ordersService.applyCouponAndClearCart(
          order.couponCode,
          order.userId,
        );
      } else {
        await this.ordersService.clearCartForUser(order.userId);
      }

      // Prefer the locale-aware result URL the client sent (validated against
      // the frontend domain); fall back to the default English path otherwise.
      // Either way, append the wallet success query params.
      const base =
        this.resolveReturnUrl(dto.returnUrl) ??
        `${this.configService.get('app.frontendDomain', {
          infer: true,
        })}/payment/result`;
      const returnUrl = this.appendWalletResultParams(base, order.orderNumber);

      return { paymentUrl: returnUrl, orderNumber: order.orderNumber };
    }

    const paymentUrl = this.onepayService.buildPaymentUrl({
      orderNumber: order.orderNumber,
      vndAmount: order.vndPrice,
      clientIp,
      orderInfo: `esim.vn - Order ${order.orderNumber}`,
      againLink: this.configService.getOrThrow('onepay', { infer: true })
        .returnUrl,
      title: 'esim.vn eSIM Payment',
      locale: dto.locale === 'en' ? 'en' : 'vn',
      returnUrl: this.resolveReturnUrl(dto.returnUrl),
    });

    return { paymentUrl, orderNumber: order.orderNumber };
  }

  /**
   * Validate a client-supplied return URL. Only honor it when it is an absolute
   * URL on the configured frontend domain — this prevents an open-redirect
   * where a crafted `returnUrl` sends buyers to an attacker-controlled site
   * after payment. Returns undefined to fall back to the env default.
   */
  private resolveReturnUrl(candidate?: string): string | undefined {
    if (!candidate) return undefined;

    const frontendDomain = this.configService.get('app.frontendDomain', {
      infer: true,
    });
    if (!frontendDomain) return undefined;

    try {
      const target = new URL(candidate);
      const allowed = new URL(frontendDomain);
      if (target.origin === allowed.origin) {
        return target.toString();
      }
    } catch {
      // Malformed URL — ignore and use the default.
    }
    return undefined;
  }

  /**
   * Append the wallet-success query params to a result URL without clobbering
   * its existing path/query, so the locale-aware path the client sent is kept.
   */
  private appendWalletResultParams(base: string, orderNumber: string): string {
    try {
      const url = new URL(base);
      url.searchParams.set('orderNumber', orderNumber);
      url.searchParams.set('success', 'true');
      url.searchParams.set('method', 'wallet');
      return url.toString();
    } catch {
      // Malformed base — fall back to naive concatenation.
      return `${base}?orderNumber=${orderNumber}&success=true&method=wallet`;
    }
  }

  async handleIpn(query: Record<string, string>): Promise<{ code: string }> {
    this.logger.log(`OnePay IPN received: ${JSON.stringify(query)}`);

    const isValid = this.onepayService.verifyIpn(query);
    if (!isValid) {
      this.logger.warn('OnePay IPN: invalid signature');
      return { code: '97' };
    }

    const orderNumber = query['vpc_MerchTxnRef'];
    this.logger.log(
      `OnePay IPN: orderNumber=${orderNumber}, TxnResponseCode=${query['vpc_TxnResponseCode']}, TransactionNo=${query['vpc_TransactionNo']}`,
    );

    if (!orderNumber) return { code: '01' };

    // Topup orders use the dedicated TOPUP- prefix. After the cash arrives
    // we mark the order PAID then fire-and-forget the provider submission.
    // We do NOT wait for the provider here — bus timeouts otherwise back
    // up to OnePay and the customer-facing return page.
    if (orderNumber.startsWith(`${TOPUP_ORDER_NUMBER_PREFIX}-`)) {
      return this.handleTopupIpn(query, orderNumber);
    }

    // Custom Payment Links use a dedicated VORD- prefix; route those to the
    // custom-payment-links service instead of the standard order flow.
    if (orderNumber.startsWith(CUSTOM_PAYMENT_VIRTUAL_ORDER_PREFIX)) {
      const link =
        await this.customPaymentLinksService.findByVirtualOrderId(orderNumber);
      if (!link) {
        this.logger.warn(
          `OnePay IPN: custom payment link not found ${orderNumber}`,
        );
        return { code: '01' };
      }
      const isSuccess = this.onepayService.isPaymentSuccess(query);
      await this.customPaymentLinksService.finalizeFromIpn(orderNumber, {
        isSuccess,
        paymentId: query['vpc_TransactionNo'] ?? null,
      });
      this.logger.log(
        `OnePay IPN: custom payment link ${orderNumber} finalized as ${
          isSuccess ? 'PAID' : 'FAILED'
        }`,
      );
      return { code: '00' };
    }

    const order = await this.ordersService.findByOrderNumber(orderNumber);
    if (!order) {
      this.logger.warn(`OnePay IPN: order not found ${orderNumber}`);
      return { code: '01' };
    }

    this.logger.log(
      `OnePay IPN: order found id=${order.id}, status=${order.status}`,
    );

    if (order.status !== 'pending') {
      this.logger.log(
        `OnePay IPN: order ${orderNumber} already processed (status=${order.status})`,
      );
      return { code: '00' };
    }

    if (!this.onepayService.isPaymentSuccess(query)) {
      // Delegate to cancelOrder for the FULL rollback: it sets status=failed,
      // releases the eXU wallet hold, decrements coupon usage AND reverses the
      // pending order-referral. The previous inline path only set status+hold,
      // leaving the referral stuck in PENDING forever (the expiry cron never
      // catches it since the order is no longer `pending`). The order is still
      // pending here (guarded above), so cancelOrder runs cleanly.
      try {
        await this.ordersService.cancelOrder(order.id);
      } catch (err) {
        this.logger.error(
          `OnePay IPN: rollback failed for ${orderNumber}: ${(err as Error).message}`,
        );
      }
      this.logger.log(
        `OnePay IPN: payment failed for ${orderNumber}, code=${query['vpc_TxnResponseCode']}`,
      );
      return { code: '00' };
    }

    try {
      this.logger.log(`OnePay IPN: finalizing paid order ${orderNumber}...`);
      await this.ordersService.finalizePaidOrder(order.id, {
        paymentMethod: 'onepay',
        paymentId: query['vpc_TransactionNo'] ?? null,
      });
      await this.ordersService.submitProviders(order.id);
      if (order.couponCode) {
        await this.ordersService.applyCouponAndClearCart(
          order.couponCode,
          order.userId,
        );
      } else {
        await this.ordersService.clearCartForUser(order.userId);
      }
      this.logger.log(`OnePay IPN: order ${orderNumber} paid and submitted`);
    } catch (err) {
      this.logger.error(
        `OnePay IPN: submitProviders failed for ${orderNumber}: ${(err as Error).message}`,
      );
    }

    return { code: '00' };
  }

  /**
   * Handle the IPN for a TOPUP order. Reuses 80% of the BUY_NEW logic but
   * delegates the post-payment provider call to {@link TopupService}.
   */
  private async handleTopupIpn(
    query: Record<string, string>,
    orderNumber: string,
  ): Promise<{ code: string }> {
    const order = await this.ordersService.findByOrderNumber(orderNumber);
    if (!order) {
      this.logger.warn(`OnePay IPN (topup): order not found ${orderNumber}`);
      return { code: '01' };
    }

    if (order.status !== TOPUP_ORDER_STATUS.PENDING) {
      this.logger.log(
        `OnePay IPN (topup): order ${orderNumber} already processed (status=${order.status})`,
      );
      return { code: '00' };
    }

    if (!this.onepayService.isPaymentSuccess(query)) {
      await this.ordersService.update(order.id, {
        status: TOPUP_ORDER_STATUS.FAILED,
      });
      this.logger.log(
        `OnePay IPN (topup): payment failed for ${orderNumber}, code=${query['vpc_TxnResponseCode']}`,
      );
      return { code: '00' };
    }

    // Mark PAID immediately, then trigger provider submission asynchronously.
    await this.ordersService.update(order.id, {
      status: TOPUP_ORDER_STATUS.PAID,
      paymentMethod: 'onepay',
      paymentId: query['vpc_TransactionNo'] ?? null,
    });

    // Fire-and-forget — do not await. The provider call may be slow and we
    // must not hold the IPN response. Errors are caught inside executeTopup
    // and reflected as MANUAL_INTERVENTION.
    void this.topupService
      .executeTopup(orderNumber)
      .catch((err) =>
        this.logger.error(
          `Async executeTopup crashed for ${orderNumber}: ${(err as Error).message}`,
        ),
      );

    this.logger.log(
      `OnePay IPN (topup): order ${orderNumber} marked PAID, provider submission scheduled`,
    );
    return { code: '00' };
  }

  private async fetchVndRate(): Promise<number> {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`);
      const data = await res.json();
      const rate: number = data?.rates?.VND;
      if (!rate) throw new Error('VND rate not found');
      return rate;
    } catch (err) {
      this.logger.error(`Failed to fetch VND rate: ${(err as Error).message}`);
      throw err;
    }
  }
}
