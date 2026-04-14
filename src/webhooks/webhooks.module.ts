import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { EsimsModule } from '../esims/esims.module';
import { OrderItemsModule } from '../order-items/order-items.module';
import { OrdersModule } from '../orders/orders.module';
import { EsimProvidersModule } from '../esim-providers/esim-providers.module';

@Module({
  imports: [EsimsModule, OrderItemsModule, OrdersModule, EsimProvidersModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
