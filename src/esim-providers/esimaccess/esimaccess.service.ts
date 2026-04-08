import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AllConfigType } from '../../config/config.type';
import { PlansService } from '../../plans/plans.service';
import { DestinationsService } from '../../destinations/destinations.service';
import { RegionsService } from '../../regions/regions.service';
import { ProviderSyncLogsService } from '../../provider-sync-logs/provider-sync-logs.service';
import {
  EsimAccessApiResponse,
  EsimAccessPackage,
} from './esimaccess-api.types';

@Injectable()
export class EsimAccessService implements OnModuleInit {
  private readonly logger = new Logger(EsimAccessService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly plansService: PlansService,
    private readonly destinationsService: DestinationsService,
    private readonly regionsService: RegionsService,
    private readonly providerSyncLogsService: ProviderSyncLogsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.syncPlans();
  }

  @Cron('0 */6 * * *')
  async syncPlans(): Promise<void> {
    this.logger.log('Starting esimaccess plan sync...');

    const syncLog = await this.providerSyncLogsService.create({
      provider: 'esimaccess',
      syncType: 'plans',
      status: 'started',
      startedAt: new Date(),
    });

    try {
      const packages = await this.fetchPackages();
      let itemsSynced = 0;

      for (const pkg of packages) {
        try {
          await this.processPackage(pkg);
          itemsSynced++;
        } catch (error) {
          this.logger.warn(
            `Failed to process package ${pkg.packageCode}: ${error.message}`,
          );
        }
      }

      await this.providerSyncLogsService.update(syncLog.id, {
        status: 'completed',
        itemsSynced,
        completedAt: new Date(),
      });

      this.logger.log(
        `Esimaccess plan sync completed. ${itemsSynced}/${packages.length} packages synced.`,
      );
    } catch (error) {
      await this.providerSyncLogsService.update(syncLog.id, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      });

      this.logger.error(`Esimaccess plan sync failed: ${error.message}`);
    }
  }

  private async fetchPackages(): Promise<EsimAccessPackage[]> {
    const baseUrl = this.configService.getOrThrow('esimAccess.baseUrl', {
      infer: true,
    });
    const accessCode = this.configService.getOrThrow(
      'esimAccess.accessCode',
      { infer: true },
    );

    const { data } = await firstValueFrom(
      this.httpService.post<EsimAccessApiResponse>(
        `${baseUrl}/api/v1/open/package/list`,
        {
          locationCode: '',
          type: '',
          packageCode: '',
          iccid: '',
        },
        {
          headers: {
            'RT-AccessCode': accessCode,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    if (!data.success) {
      throw new Error(
        `API error: ${data.errorCode} - ${data.errorMsg}`,
      );
    }

    return data.obj.packageList;
  }

  private async processPackage(pkg: EsimAccessPackage): Promise<void> {
    const locationCodes = pkg.location.split(',').map((s) => s.trim());
    const isRegionPackage = locationCodes.length > 1;

    if (isRegionPackage) {
      const region = await this.resolveRegion(pkg, locationCodes);
      await this.upsertPlan(pkg, null, region.id);
    } else {
      const destination = await this.resolveDestination(pkg);
      await this.upsertPlan(pkg, destination.id, null);
    }
  }

  private async resolveDestination(pkg: EsimAccessPackage) {
    const existing = await this.destinationsService.findByCountryCode(
      pkg.locationCode,
    );
    if (existing) return existing;

    const locationInfo = pkg.locationNetworkList?.[0];
    const name = locationInfo?.locationName || pkg.locationCode;
    const flagUrl = locationInfo?.locationLogo || null;
    const slug = pkg.locationCode.toLowerCase();

    try {
      return await this.destinationsService.create({
        name,
        slug,
        countryCode: pkg.locationCode,
        flagUrl,
        isActive: true,
      });
    } catch {
      const bySlug = await this.destinationsService.findBySlug(slug);
      if (bySlug) return bySlug;
      throw new Error(`Failed to resolve destination for ${pkg.locationCode}`);
    }
  }

  private async resolveDestinationByCode(
    code: string,
    name?: string,
    flagUrl?: string | null,
  ) {
    const existing = await this.destinationsService.findByCountryCode(code);
    if (existing) return existing;

    try {
      return await this.destinationsService.create({
        name: name || code,
        slug: code.toLowerCase(),
        countryCode: code,
        flagUrl: flagUrl || null,
        isActive: true,
      });
    } catch {
      // Slug conflict — find by slug instead
      const bySlug = await this.destinationsService.findBySlug(
        code.toLowerCase(),
      );
      if (bySlug) return bySlug;
      throw new Error(`Failed to create or find destination for ${code}`);
    }
  }

  private async resolveRegion(
    pkg: EsimAccessPackage,
    locationCodes: string[],
  ) {
    const regionSlug = `esimaccess-${pkg.locationCode.toLowerCase()}`;
    const existing = await this.regionsService.findBySlug(regionSlug);

    let region: { id: number };
    if (existing) {
      region = existing;
    } else {
      try {
        region = await this.regionsService.create({
          name: pkg.name.split(' ')[0] || pkg.locationCode,
          slug: regionSlug,
          isActive: true,
        });
      } catch {
        const retry = await this.regionsService.findBySlug(regionSlug);
        if (retry) {
          region = retry;
        } else {
          throw new Error(`Failed to create or find region ${regionSlug}`);
        }
      }
    }

    // Link each country code to a destination and associate with region
    const networkMap = new Map(
      (pkg.locationNetworkList ?? []).map((n) => [n.locationCode, n]),
    );

    for (const code of locationCodes) {
      const networkInfo = networkMap.get(code);
      const dest = await this.resolveDestinationByCode(
        code,
        networkInfo?.locationName,
        networkInfo?.locationLogo,
      );
      await this.destinationsService.addRegion(dest.id, region.id);
    }

    return region;
  }

  private async upsertPlan(
    pkg: EsimAccessPackage,
    destinationId: number | null,
    regionId: number | null,
  ) {
    const slug = `esimaccess-${pkg.packageCode}`;
    const existing = await this.plansService.findBySlug(slug);

    const dataTypeMap: Record<number, string> = {
      1: 'data-in-total',
      2: 'daily-limit-speed-reduced',
      3: 'daily-limit-service-cutoff',
      4: 'daily-unlimited',
    };

    const costPrice = pkg.price;
    const planData = {
      provider: 'esimaccess',
      providerPlanId: pkg.packageCode,
      name: pkg.name,
      countryCode: destinationId ? pkg.location : null,
      destinationId,
      regionId,
      durationDays: pkg.duration,
      dataGb: pkg.volume / 1024 / 1024 / 1024,
      costPrice,
      price: costPrice,
      retailPrice: pkg.retailPrice,
      currency: pkg.currencyCode,
      type: dataTypeMap[pkg.dataType] ?? 'data-in-total',
      topUp: pkg.supportTopUpType === 2,
      isActive: true,
    };

    if (existing) {
      return this.plansService.update(existing.id, planData);
    }

    return this.plansService.create({
      ...planData,
      slug,
    });
  }
}
