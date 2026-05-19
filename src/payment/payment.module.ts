import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { OnepayModule } from './onepay.module';
import { OrdersModule } from '../orders/orders.module';
import { CustomPaymentLinksModule } from '../custom-payment-links/custom-payment-links.module';

@Module({
  imports: [OrdersModule, OnepayModule, CustomPaymentLinksModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
