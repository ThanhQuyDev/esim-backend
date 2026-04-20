import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AllConfigType } from '../../config/config.type';
import { PlansService } from '../../plans/plans.service';
import { DestinationsService } from '../../destinations/destinations.service';
import { RegionsService } from '../../regions/regions.service';
import { ProfitMarginsService } from '../../profit-margins/profit-margins.service';
import { ProviderSyncLogsService } from '../../provider-sync-logs/provider-sync-logs.service';
import {
  AiraloTokenResponse,
  AiraloPackagesResponse,
  AiraloCountry,
  AiraloOperator,
  AiraloPackage,
  AiraloOperatorCountry,
  AiraloOrderAsyncRequest,
  AiraloOrderAsyncResponse,
} from './airalo-api.types';

@Injectable()
export class AiraloService {
  private readonly logger = new Logger(AiraloService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly plansService: PlansService,
    private readonly destinationsService: DestinationsService,
    private readonly regionsService: RegionsService,
    private readonly profitMarginsService: ProfitMarginsService,
    private readonly providerSyncLogsService: ProviderSyncLogsService,
  ) {}

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
      const profitPercentage =
        await this.profitMarginsService.getActivePercentage();
      let itemsSynced = 0;

      for (const country of countries) {
        for (const operator of country.operators) {
          for (const pkg of operator.packages) {
            if (pkg.type === 'topup') continue;

            try {
              await this.processPackage(
                country,
                operator,
                pkg,
                profitPercentage,
              );
              itemsSynced++;
            } catch (error: any) {
              this.logger.error(
                `Failed to process airalo package ${pkg.id} (${pkg.title}): ${error.message}`,
                error.stack,
              );
              this.logger.error(
                `Package data: ${JSON.stringify({ id: pkg.id, type: pkg.type, country: country.country_code, operator: operator.title, countriesCount: operator.countries?.length })}`,
              );

              await this.providerSyncLogsService.update(syncLog.id, {
                status: 'failed',
                itemsSynced,
                errorMessage: `Package ${pkg.id}: ${error.message}`,
                completedAt: new Date(),
              });

              throw error;
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
    } catch (error: any) {
      if (!error._logged) {
        await this.providerSyncLogsService.update(syncLog.id, {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        });
      }

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
        this.httpService.get<AiraloPackagesResponse>(`${baseUrl}/v2/packages`, {
          params: { page, limit: 100 },
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }),
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
    profitPercentage: number,
  ): Promise<void> {
    const operatorCountries = operator.countries ?? [];
    const isRegionPackage = operatorCountries.length > 1;

    if (isRegionPackage) {
      const region = await this.resolveRegion(country, operatorCountries);
      await this.upsertPlan(
        country,
        operator,
        pkg,
        null,
        region.id,
        profitPercentage,
      );
    } else {
      const destination = await this.resolveDestination(
        country.country_code,
        country.title,
        country.image?.url || null,
      );
      await this.upsertPlan(
        country,
        operator,
        pkg,
        destination.id,
        null,
        profitPercentage,
      );
    }
  }

  private async resolveDestination(
    countryCode: string,
    title: string,
    flagUrl: string | null,
  ) {
    const existing =
      await this.destinationsService.findByCountryCode(countryCode);
    if (existing) return existing;

    const byName = await this.destinationsService.findByName(title);
    if (byName) return byName;

    const slug = this.toSlug(title);
    try {
      return await this.destinationsService.create({
        name: title,
        slug,
        countryCode,
        flagUrl,
        isActive: true,
      });
    } catch {
      const bySlug = await this.destinationsService.findBySlug(slug);
      if (bySlug) return bySlug;
      throw new Error(`Failed to resolve destination for ${countryCode}`);
    }
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
    profitPercentage: number,
  ) {
    const locationName = country.title;
    const planType = pkg.is_unlimited
      ? 'daily-limit-speed-reduced'
      : 'data-in-total';
    const slug = this.buildPlanSlug(
      locationName,
      pkg.amount / 1024,
      pkg.day,
      'airalo',
      planType,
    );
    const existing = await this.plansService.findBySlug(slug);

    const costPrice = pkg.net_price;
    const price =
      Math.round(costPrice * (1 + profitPercentage / 100) * 100) / 100;
    const planData = {
      provider: 'airalo',
      providerPlanId: pkg.id,
      name: pkg.title,
      countryCode: destinationId ? country.country_code : null,
      destinationId,
      regionId,
      durationDays: pkg.day,
      dataGb: pkg.is_unlimited ? 3 : pkg.amount / 1024,
      costPrice,
      price,
      retailPrice: pkg.price,
      currency: 'USD',
      sms: pkg.text ?? null,
      call: pkg.voice ?? null,
      type: planType,
      topUp: true,
      speed:
        [
          ...new Set(
            (operator.coverages ?? [])
              .flatMap((c) => c.networks ?? [])
              .flatMap((n) => n.types ?? []),
          ),
        ].join(',') || null,
      operatorName:
        [
          ...new Set(
            (operator.coverages ?? [])
              .flatMap((c) => c.networks ?? [])
              .map((n) => n.name)
              .filter(Boolean),
          ),
        ].join(',') || null,
      fupSpeed: pkg.is_unlimited ? '1 Mbps' : null,
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

  async submitOrderAsync(params: {
    packageId: string;
    quantity: number;
    type?: 'sim' | 'esim';
    description?: string;
    webhookUrl?: string;
  }): Promise<AiraloOrderAsyncResponse['data']> {
    const token = await this.authenticate();
    const baseUrl = this.configService.getOrThrow('airalo.baseUrl', {
      infer: true,
    });

    const body: AiraloOrderAsyncRequest = {
      quantity: params.quantity,
      package_id: params.packageId,
      type: params.type ?? 'sim',
      description: params.description,
      webhook_url: params.webhookUrl,
    };

    this.logger.log(
      `Submitting async order to Airalo: package_id=${params.packageId}, qty=${params.quantity}`,
    );

    const { data } = await firstValueFrom(
      this.httpService.post<AiraloOrderAsyncResponse>(
        `${baseUrl}/v2/orders-async`,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      ),
    );

    this.logger.log(
      `Airalo async order submitted: request_id=${data.data.request_id}, accepted_at=${data.data.accepted_at}`,
    );

    return data.data;
  }

  private buildPlanSlug(
    locationName: string,
    dataGb: number,
    days: number,
    provider: string,
    type: string,
  ): string {
    const name = locationName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    const prefix = provider.substring(0, 2).toLowerCase();
    const dataPart = dataGb > 0 ? `-${dataGb}gb` : '';
    const unlimitedPart =
      type === 'daily-unlimited' || type === 'daily-limit-speed-reduced'
        ? '-unlimited'
        : '';
    return `${name}${dataPart}-${days}days${unlimitedPart}-${prefix}`;
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}
