import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { EsimAccessService } from './esimaccess/esimaccess.service';
import { AiraloService } from './airalo/airalo.service';
import { SyncOrchestratorService } from './sync-orchestrator.service';
import { GadgetKoreaService } from './gadgetkorea/gadgetkorea.service';
import { PlansModule } from '../plans/plans.module';
import { DestinationsModule } from '../destinations/destinations.module';
import { RegionsModule } from '../regions/regions.module';
import { ProfitMarginsModule } from '../profit-margins/profit-margins.module';
import { ProviderSyncLogsModule } from '../provider-sync-logs/provider-sync-logs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    PlansModule,
    DestinationsModule,
    RegionsModule,
    ProfitMarginsModule,
    ProviderSyncLogsModule,
  ],
  providers: [
    EsimAccessService,
    AiraloService,
    SyncOrchestratorService,
    GadgetKoreaService,
  ],
  exports: [AiraloService, EsimAccessService, GadgetKoreaService],
})
export class EsimProvidersModule {}
