import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnepayService } from './onepay.service';
import { OrdersService } from '../orders/orders.service';
import { AllConfigType } from '../config/config.type';
import { SubmitOrderDto } from '../orders/dto/submit-order.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly onepayService: OnepayService,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService<AllConfigType>,
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

    const paymentUrl = this.onepayService.buildPaymentUrl({
      orderNumber: order.orderNumber,
      vndAmount: order.vndPrice,
      clientIp,
      orderInfo: `esim.vn - Order ${order.orderNumber}`,
      againLink: this.configService.getOrThrow('onepay', { infer: true })
        .returnUrl,
      title: 'esim.vn eSIM Payment',
    });

    return { paymentUrl, orderNumber: order.orderNumber };
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
      await this.ordersService.update(order.id, { status: 'failed' });
      await this.ordersService.releaseWalletHoldForOrder(order.id);
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
