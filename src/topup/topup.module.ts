import { Module } from '@nestjs/common';
import { TopupController } from './topup.controller';
import { TopupService } from './topup.service';
import { OrdersModule } from '../orders/orders.module';
import { EsimsModule } from '../esims/esims.module';
import { PlansModule } from '../plans/plans.module';
import { EsimProvidersModule } from '../esim-providers/esim-providers.module';
import { OnepayModule } from '../payment/onepay.module';

@Module({
  imports: [
    // OrdersModule re-exports its persistence module, which gives us
    // the OrderRepository abstract that TopupService consumes.
    OrdersModule,
    EsimsModule,
    PlansModule,
    EsimProvidersModule,
    OnepayModule,
  ],
  controllers: [TopupController],
  providers: [TopupService],
  exports: [TopupService],
})
export class TopupModule {}
