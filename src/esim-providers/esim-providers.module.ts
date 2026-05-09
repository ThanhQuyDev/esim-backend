import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { EsimAccessService } from './esimaccess/esimaccess.service';
import { AiraloService } from './airalo/airalo.service';
import { SyncOrchestratorService } from './sync-orchestrator.service';
import { GadgetKoreaService } from './gadgetkorea/gadgetkorea.service';
import { JapanTravelSimService } from './japantravelsim/japantravelsim.service';
import { PlansModule } from '../plans/plans.module';
import { DestinationsModule } from '../destinations/destinations.module';
import { RegionsModule } from '../regions/regions.module';
import { ProfitMarginsModule } from '../profit-margins/profit-margins.module';
import { ProviderSyncLogsModule } from '../provider-sync-logs/provider-sync-logs.module';
import { OrderItemsModule } from '../order-items/order-items.module';
import { EsimsModule } from '../esims/esims.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    PlansModule,
    DestinationsModule,
    RegionsModule,
    ProfitMarginsModule,
    ProviderSyncLogsModule,
    OrderItemsModule,
    forwardRef(() => EsimsModule),
    MailModule,
    UsersModule,
    forwardRef(() => OrdersModule),
  ],
  providers: [
    EsimAccessService,
    AiraloService,
    SyncOrchestratorService,
    GadgetKoreaService,
    JapanTravelSimService,
  ],
  exports: [
    AiraloService,
    EsimAccessService,
    GadgetKoreaService,
    JapanTravelSimService,
  ],
})
export class EsimProvidersModule {}
