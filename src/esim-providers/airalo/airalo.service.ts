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
  AiraloTokenResponse,
  AiraloPackagesResponse,
  AiraloCountry,
  AiraloOperator,
  AiraloPackage,
  AiraloOperatorCountry,
} from './airalo-api.types';

@Injectable()
export class AiraloService implements OnModuleInit {
  private readonly logger = new Logger(AiraloService.name);

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
    this.logger.log('Starting airalo plan sync...');

    const syncLog = await this.providerSyncLogsService.create({
      provider: 'airalo',
      syncType: 'plans',
      status: 'started',
      startedAt: new Date(),
    });

    try {
      const token = await this.authenticate();
      const countries = await this.fetchAllPackages(token);
      let itemsSynced = 0;

      for (const country of countries) {
        for (const operator of country.operators) {
          for (const pkg of operator.packages) {
            if (pkg.type === 'topup') continue;

            try {
              await this.processPackage(country, operator, pkg);
              itemsSynced++;
            } catch (error) {
              this.logger.warn(
                `Failed to process airalo package ${pkg.id}: ${error.message}`,
              );
            }
          }
        }
      }

      await this.providerSyncLogsService.update(syncLog.id, {
        status: 'completed',
        itemsSynced,
        completedAt: new Date(),
      });

      this.logger.log(
        `Airalo plan sync completed. ${itemsSynced} packages synced.`,
      );
    } catch (error) {
      await this.providerSyncLogsService.update(syncLog.id, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
      });

      this.logger.error(`Airalo plan sync failed: ${error.message}`);
    }
  }

  private async authenticate(): Promise<string> {
    const baseUrl = this.configService.getOrThrow('airalo.baseUrl', {
      infer: true,
    });
    const clientId = this.configService.getOrThrow('airalo.clientId', {
      infer: true,
    });
    const clientSecret = this.configService.getOrThrow('airalo.clientSecret', {
      infer: true,
    });

    const { data } = await firstValueFrom(
      this.httpService.post<AiraloTokenResponse>(`${baseUrl}/v2/token`, {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    );

    return data.data.access_token;
  }

  private async fetchAllPackages(token: string): Promise<AiraloCountry[]> {
    const baseUrl = this.configService.getOrThrow('airalo.baseUrl', {
      infer: true,
    });

    const allCountries: AiraloCountry[] = [];
    let page = 1;
    let lastPage = 1;

    do {
      const { data } = await firstValueFrom(
        this.httpService.get<AiraloPackagesResponse>(
          `${baseUrl}/v2/packages`,
          {
            params: { page, limit: 100 },
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          },
        ),
      );

      allCountries.push(...data.data);
      lastPage = data.meta.last_page;
      page++;
    } while (page <= lastPage);

    return allCountries;
  }

  private async processPackage(
    country: AiraloCountry,
    operator: AiraloOperator,
    pkg: AiraloPackage,
  ): Promise<void> {
    const operatorCountries = operator.countries ?? [];
    const isRegionPackage = operatorCountries.length > 1;

    if (isRegionPackage) {
      const region = await this.resolveRegion(country, operatorCountries);
      await this.upsertPlan(country, operator, pkg, null, region.id);
    } else {
      const destination = await this.resolveDestination(
        country.country_code,
        country.title,
        country.image?.url || null,
        country.slug,
      );
      await this.upsertPlan(country, operator, pkg, destination.id, null);
    }
  }

  private async resolveDestination(
    countryCode: string,
    title: string,
    flagUrl: string | null,
    slug: string,
  ) {
    const existing =
      await this.destinationsService.findByCountryCode(countryCode);
    if (existing) return existing;

    return this.destinationsService.create({
      name: title,
      slug,
      countryCode,
      flagUrl,
      isActive: true,
    });
  }

  private async resolveRegion(
    country: AiraloCountry,
    operatorCountries: AiraloOperatorCountry[],
  ) {
    const regionSlug = `airalo-${country.slug}`;
    const existing = await this.regionsService.findBySlug(regionSlug);

    let region: { id: number };
    if (existing) {
      region = existing;
    } else {
      region = await this.regionsService.create({
        name: country.title,
        slug: regionSlug,
        avatarUrl: country.image?.url || null,
        isActive: true,
      });
    }

    // Link each country in the region to a destination
    for (const c of operatorCountries) {
      const dest = await this.resolveDestination(
        c.country_code,
        c.title,
        c.image?.url || null,
        c.country_code.toLowerCase(),
      );
      await this.destinationsService.addRegion(dest.id, region.id);
    }

    return region;
  }

  private async upsertPlan(
    country: AiraloCountry,
    operator: AiraloOperator,
    pkg: AiraloPackage,
    destinationId: number | null,
    regionId: number | null,
  ) {
    const slug = `airalo-${pkg.id}`;
    const existing = await this.plansService.findBySlug(slug);

    const costPrice = pkg.net_price;
    const planData = {
      provider: 'airalo',
      providerPlanId: pkg.id,
      name: pkg.title,
      countryCode: destinationId ? country.country_code : null,
      destinationId,
      regionId,
      durationDays: pkg.day,
      dataGb: pkg.amount / 1024,
      costPrice,
      price: costPrice,
      retailPrice: pkg.price,
      currency: 'USD',
      type: pkg.is_unlimited ? 'daily-unlimited' : 'data-in-total',
      topUp: true,
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
