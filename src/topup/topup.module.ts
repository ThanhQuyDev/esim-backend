import { Module } from '@nestjs/common';
import { TopupController } from './topup.controller';
import { TopupService } from './topup.service';
import { OrdersModule } from '../orders/orders.module';
import { EsimsModule } from '../esims/esims.module';
import { PlansModule } from '../plans/plans.module';
import { EsimProvidersModule } from '../esim-providers/esim-providers.module';
import { OnepayModule } from '../payment/onepay.module';
import { ProfitMarginsModule } from '../profit-margins/profit-margins.module';
import { WalletsModule } from '../wallets/wallets.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    // OrdersModule re-exports its persistence module, which gives us
    // the OrderRepository abstract that TopupService consumes.
    OrdersModule,
    EsimsModule,
    PlansModule,
    EsimProvidersModule,
    OnepayModule,
    // Provides ProfitMarginsService so Airalo / eSIMAccess topups apply the
    // same tiered profit margin as SIM plans.
    ProfitMarginsModule,
    // Paying a topup from the eXu balance, and attaching a VAT invoice
    // request to it (#028).
    WalletsModule,
    InvoicesModule,
  ],
  controllers: [TopupController],
  providers: [TopupService],
  exports: [TopupService],
})
export class TopupModule {}
