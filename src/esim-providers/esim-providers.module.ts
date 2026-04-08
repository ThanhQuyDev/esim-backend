import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { EsimAccessService } from './esimaccess/esimaccess.service';
import { AiraloService } from './airalo/airalo.service';
import { PlansModule } from '../plans/plans.module';
import { DestinationsModule } from '../destinations/destinations.module';
import { RegionsModule } from '../regions/regions.module';
import { ProviderSyncLogsModule } from '../provider-sync-logs/provider-sync-logs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    PlansModule,
    DestinationsModule,
    RegionsModule,
    ProviderSyncLogsModule,
  ],
  providers: [AiraloService, EsimAccessService],
})
export class EsimProvidersModule {}
