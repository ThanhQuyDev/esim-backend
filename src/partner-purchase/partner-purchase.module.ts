import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PartnersModule } from '../partners/partners.module';
import { TopupModule } from '../topup/topup.module';
import { PartnerPurchaseController } from './partner-purchase.controller';
import { PartnerPurchaseService } from './partner-purchase.service';

/**
 * Đối tác phân phối tự đặt mua hàng (#046).
 *
 * Module lá — nó import `OrdersModule` và `PartnersModule`, và **không ai
 * import nó**. Đó là điều giữ cho đồ thị phụ thuộc không khép vòng:
 * `OrdersModule` vốn đã import `PartnersModule`, nên luồng này không thể nằm
 * trong `PartnersService` mà vẫn gọi được `OrdersService`.
 */
@Module({
  // TopupModule: "Topup hộ khách" from an eSIM's page (doitac-1410 #039).
  imports: [PartnersModule, OrdersModule, TopupModule],
  controllers: [PartnerPurchaseController],
  providers: [PartnerPurchaseService],
  exports: [PartnerPurchaseService],
})
export class PartnerPurchaseModule {}
