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
  EsimAccessApiResponse,
  EsimAccessPackage,
  EsimAccessOrderRequest,
  EsimAccessOrderResponse,
  EsimAccessQueryEsimResponse,
  EsimAccessQueryEsimItem,
  EsimAccessUsageResponse,
  EsimAccessUsageItem,
} from './esimaccess-api.types';

@Injectable()
export class EsimAccessService {
  private readonly logger = new Logger(EsimAccessService.name);

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
    this.logger.log('Starting esimaccess plan sync...');
    const syncStartedAt = new Date();

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
        } catch (error: any) {
          this.logger.error(
            `Failed to process package ${pkg.packageCode} (${pkg.name}): ${error.message}`,
            error.stack,
          );
          this.logger.error(
            `Package data: ${JSON.stringify({ packageCode: pkg.packageCode, slug: pkg.slug, location: pkg.location, locationCode: pkg.locationCode })}`,
          );

          await this.providerSyncLogsService.update(syncLog.id, {
            status: 'failed',
            itemsSynced,
            errorMessage: `Package ${pkg.packageCode}: ${error.message}`,
            completedAt: new Date(),
          });

          throw error;
        }
      }

      await this.providerSyncLogsService.update(syncLog.id, {
        status: 'completed',
        itemsSynced,
        completedAt: new Date(),
      });

      await this.plansService.deactivateStaleProviderPlans(
        'esimaccess',
        syncStartedAt,
      );

      this.logger.log(
        `Esimaccess plan sync completed. ${itemsSynced}/${packages.length} packages synced.`,
      );
    } catch (error: any) {
      if (!error._logged) {
        await this.providerSyncLogsService.update(syncLog.id, {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        });
      }

      this.logger.error(`Esimaccess plan sync failed: ${error.message}`);
    }
  }

  private async fetchPackages(): Promise<EsimAccessPackage[]> {
    const baseUrl = this.configService.getOrThrow('esimAccess.baseUrl', {
      infer: true,
    });
    const accessCode = this.configService.getOrThrow('esimAccess.accessCode', {
      infer: true,
    });

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
      throw new Error(`API error: ${data.errorCode} - ${data.errorMsg}`);
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

    const byName = await this.destinationsService.findByName(name);
    if (byName) return byName;
    const flagUrl = locationInfo?.locationLogo || null;
    const slug = this.toSlug(name);

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

    const displayName = name || code;

    const byName = await this.destinationsService.findByName(displayName);
    if (byName) return byName;

    try {
      return await this.destinationsService.create({
        name: displayName,
        slug: this.toSlug(displayName),
        countryCode: code,
        flagUrl: flagUrl || null,
        isActive: true,
      });
    } catch {
      // Slug conflict — find by slug instead
      const bySlug = await this.destinationsService.findBySlug(
        this.toSlug(displayName),
      );
      if (bySlug) return bySlug;
      throw new Error(`Failed to create or find destination for ${code}`);
    }
  }

  private async resolveRegion(pkg: EsimAccessPackage, locationCodes: string[]) {
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

  private parseFupMbps(fupPolicy: string): number {
    if (!fupPolicy) return 0;
    const normalized = fupPolicy.replace(/\s+/g, ' ').trim();
    const match = normalized.match(/([\d.]+)\s*([KkMmGg]bps)/i);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'gbps') return val * 1000;
    if (unit === 'kbps') return val / 1000;
    return val;
  }

  private buildPlanName(
    locationName: string,
    dataMb: number,
    durationDays: number,
    type: string,
  ): string {
    const dataLabel = dataMb >= 1024 ? `${dataMb / 1024}GB` : `${dataMb}MB`;
    switch (type) {
      case 'fixed':
        return `${locationName} ${dataLabel} / ${durationDays}day`;
      case 'daily':
        return `${locationName} ${dataLabel} per day`;
      case 'unlimited-reduce':
      case 'unlimited':
        return `${locationName} unlimited`;
      default:
        return `${locationName} ${dataLabel} / ${durationDays}day`;
    }
  }

  private async upsertPlan(
    pkg: EsimAccessPackage,
    destinationId: number | null,
    regionId: number | null,
  ) {
    const dataTypeMap: Record<number, string> = {
      1: 'fixed',
      3: 'daily-limit-service-cutoff',
      4: 'unlimited',
    };

    const locationName =
      pkg.locationNetworkList?.[0]?.locationName || pkg.location;
    const dataMb = Math.round(pkg.volume / 1024 / 1024);

    let planType: string;
    if (pkg.dataType === 2) {
      const fupMbps = this.parseFupMbps(pkg.fupPolicy);
      planType = fupMbps >= 1 ? 'unlimited-reduce' : 'daily';
    } else {
      planType = dataTypeMap[pkg.dataType] ?? 'fixed';
    }

    const slug = this.buildPlanSlug(
      locationName,
      dataMb,
      pkg.duration,
      'esimaccess',
      planType,
    );
    const existing = await this.plansService.findBySlug(slug);

    const planName = this.buildPlanName(
      locationName,
      dataMb,
      pkg.duration,
      planType,
    );

    const costPrice = pkg.price / 10000;
    // During sync, set price = costPrice (no profit).
    // Tier-based profit recalculation happens separately via recalculateAllPlanPrices().
    const price = costPrice;
    const planData = {
      provider: 'esimaccess',
      providerPlanId: pkg.packageCode,
      name: planName,
      countryCode: destinationId ? pkg.location : null,
      destinationId,
      regionId,
      durationDays: pkg.duration,
      dataMb: Math.round(pkg.volume / 1024 / 1024),
      costPrice,
      price,
      retailPrice: pkg.retailPrice / 10000,
      currency: pkg.currencyCode,
      sms: null,
      call: null,
      type: planType,
      topUp: pkg.supportTopUpType === 2,
      speed: pkg.speed || null,
      operatorName:
        (pkg.locationNetworkList ?? [])
          .flatMap((l) => l.operatorList ?? [])
          .map((o) => o.operatorName)
          .filter(Boolean)
          .join(',') || null,
      fupSpeed: pkg.fupPolicy || null,
      isAbleMultidate: pkg.dataType === 2,
      isKyc: false,
      apn: null,
      lastSyncedAt: new Date(),
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

  async submitOrder(params: {
    transactionId: string;
    amount: number;
    packageInfoList: { packageCode: string; count: number; price: number }[];
  }): Promise<EsimAccessOrderResponse['obj']> {
    const baseUrl = this.configService.getOrThrow('esimAccess.baseUrl', {
      infer: true,
    });
    const accessCode = this.configService.getOrThrow('esimAccess.accessCode', {
      infer: true,
    });

    const body: EsimAccessOrderRequest = {
      transactionId: params.transactionId,
      amount: params.amount,
      packageInfoList: params.packageInfoList,
    };

    this.logger.log(
      `Submitting order to EsimAccess: txn=${params.transactionId}, amount=${params.amount}`,
    );

    const { data } = await firstValueFrom(
      this.httpService.post<EsimAccessOrderResponse>(
        `${baseUrl}/api/v1/open/esim/order`,
        body,
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
        `EsimAccess order failed: ${data.errorCode} - ${data.errorMsg}`,
      );
    }

    this.logger.log(`EsimAccess order submitted: orderNo=${data.obj.orderNo}`);

    return data.obj;
  }

  async queryEsims(orderNo: string): Promise<EsimAccessQueryEsimItem[]> {
    const baseUrl = this.configService.getOrThrow('esimAccess.baseUrl', {
      infer: true,
    });
    const accessCode = this.configService.getOrThrow('esimAccess.accessCode', {
      infer: true,
    });

    this.logger.log(`Querying EsimAccess eSIMs for orderNo=${orderNo}`);

    const { data } = await firstValueFrom(
      this.httpService.post<EsimAccessQueryEsimResponse>(
        `${baseUrl}/api/v1/open/esim/query`,
        { orderNo, pager: { pageNum: 1, pageSize: 20 } },
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
        `EsimAccess query failed: ${data.errorCode} - ${data.errorMsg}`,
      );
    }

    return data.obj?.esimList ?? [];
  }

  async getDataUsage(esimTranNo: string): Promise<EsimAccessUsageItem> {
    const baseUrl = this.configService.getOrThrow('esimAccess.baseUrl', {
      infer: true,
    });
    const accessCode = this.configService.getOrThrow('esimAccess.accessCode', {
      infer: true,
    });

    const { data } = await firstValueFrom(
      this.httpService.post<EsimAccessUsageResponse>(
        `${baseUrl}/api/v1/open/esim/usage/query`,
        { esimTranNoList: [esimTranNo] },
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
        `EsimAccess usage query failed: ${data.errorCode} - ${data.errorMsg}`,
      );
    }

    const item = data.obj?.esimUsageList?.[0];
    if (!item) {
      throw new Error(`No usage data returned for esimTranNo=${esimTranNo}`);
    }

    return item;
  }

  private buildPlanSlug(
    locationName: string,
    dataMb: number,
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
    const dataLabel =
      dataMb > 0
        ? `-${this.formatDataSize(dataMb * 1024 * 1024).toLowerCase()}`
        : '';
    return `${name}${dataLabel}-${days}days-${type}-${prefix}`;
  }

  private formatDataSize(volumeBytes: number): string {
    const mb = volumeBytes / 1024 / 1024;
    if (mb >= 1024) {
      const gb = mb / 1024;
      return gb % 1 === 0 ? `${gb}GB` : `${gb.toFixed(1)}GB`;
    }
    return mb % 1 === 0 ? `${mb}MB` : `${mb.toFixed(0)}MB`;
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
