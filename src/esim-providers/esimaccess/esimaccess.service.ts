import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AllConfigType } from '../../config/config.type';
import { PlansService } from '../../plans/plans.service';
import { parseValidityDays } from '../../plans/plan-activation';
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
  EsimAccessTopupRequest,
  EsimAccessTopupResponse,
} from './esimaccess-api.types';
import {
  buildEsimAccessOrder,
  EsimAccessOrderLine,
  isAmountMismatch,
} from './esimaccess-order';

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
      const filteredPackages = pairNonhkipVariants(packages);
      this.logger.log(
        `Filtered packages: ${packages.length} -> ${filteredPackages.length} (regular + nonhkip kept)`,
      );
      let itemsSynced = 0;

      for (const { pkg, slugSuffix } of filteredPackages) {
        try {
          await this.processPackage(pkg, slugSuffix);
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

  private async processPackage(
    pkg: EsimAccessPackage,
    slugSuffix = '',
  ): Promise<void> {
    const locationCodes = pkg.location.split(',').map((s) => s.trim());
    const isRegionPackage = locationCodes.length > 1;

    if (isRegionPackage) {
      const region = await this.resolveRegion(pkg, locationCodes);
      await this.upsertPlan(
        pkg,
        null,
        region.id,
        region.name ?? null,
        slugSuffix,
      );
    } else {
      const destination = await this.resolveDestination(pkg);
      await this.upsertPlan(pkg, destination.id, null, null, slugSuffix);
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
    // `externalCode` is the stable provider identity key. The CMS can freely
    // change name/slug for display/SEO without detaching plans from this region.
    const externalCode = `esimaccess-${pkg.locationCode.toLowerCase()}`;
    const existing = await this.regionsService.findByExternalCode(externalCode);

    let region: { id: number; name?: string };
    if (existing) {
      region = existing;
    } else {
      try {
        region = await this.regionsService.create({
          name: pkg.name.split(' ')[0] || pkg.locationCode,
          slug: externalCode,
          externalCode,
          isActive: true,
        });
      } catch {
        const retry =
          await this.regionsService.findByExternalCode(externalCode);
        if (retry) {
          region = retry;
        } else {
          throw new Error(`Failed to create or find region ${externalCode}`);
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

  private formatHotSpotAllow(planType: string, dataMb: number): string | null {
    // Only unlimited / unlimited-reduce plans have no fixed hotspot quota.
    // fixed & daily plans have a concrete data allowance (MB/GB).
    if (planType === 'unlimited' || planType === 'unlimited-reduce') {
      return null;
    }
    if (!dataMb || dataMb <= 0) {
      return null;
    }
    if (dataMb < 1024) {
      return `${dataMb}MB`;
    }
    const gb = dataMb / 1024;
    if (Number.isInteger(gb)) {
      return `${gb}GB`;
    }
    // Round to 1 decimal place and strip trailing ".0" for clean labels
    const rounded = Math.round(gb * 10) / 10;
    return `${rounded}GB`;
  }

  private async upsertPlan(
    pkg: EsimAccessPackage,
    destinationId: number | null,
    regionId: number | null,
    /** Region display name, for regional packages only. */
    regionName: string | null = null,
    /** Set on the regular twin of a "(nonhkip)" package (vande #017). */
    slugSuffix = '',
  ) {
    const dataTypeMap: Record<number, string> = {
      1: 'fixed',
      3: 'daily-limit-service-cutoff',
      4: 'unlimited',
    };

    const locationName =
      pkg.locationNetworkList?.[0]?.locationName || pkg.location;
    const dataMb = Math.round(pkg.volume / 1024 / 1024);

    /*
     * A regional package covers many countries, and `locationNetworkList[0]`
     * is just whichever one the provider happened to list first. Naming the
     * plan after it produced things like "Japan 5GB / 30day" for an Asia pack —
     * unsearchable, because nobody can guess which country came first (#036).
     * So a regional plan is named after its REGION.
     *
     * Only the display NAME changes here. The slug is built from
     * `pkg.locationCode` (e.g. `eu-42-3gb-30days-fixed-es`), and the upsert
     * matches existing plans by slug — so a re-sync renames the plans already
     * in the catalogue instead of creating duplicates alongside them.
     */
    const displayLocationName = regionId
      ? (regionName ?? locationName)
      : locationName;

    let planType: string;
    if (pkg.dataType === 2) {
      const fupMbps = this.parseFupMbps(pkg.fupPolicy);
      planType = fupMbps >= 1 ? 'unlimited-reduce' : 'daily';
    } else {
      planType = dataTypeMap[pkg.dataType] ?? 'fixed';
    }

    const slug =
      this.buildPlanSlug(
        locationName,
        dataMb,
        pkg.duration,
        'esimaccess',
        planType,
        pkg,
      ) + slugSuffix;
    const existing = await this.plansService.findBySlug(slug);

    const planName = this.buildPlanName(
      displayLocationName,
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
      // How long the customer has to activate before the eSIM is wasted (#070).
      // esimaccess calls this the unused-package validity and quotes it in days.
      activationValidityDays: parseValidityDays(pkg.unusedValidTime),
      hotSpot: true,
      hotSpotAllow: this.formatHotSpotAllow(planType, dataMb),
      // TikTok / ChatGPT work unless traffic exits via Hong Kong (#043, test
      // round 4): judged from the package's exit IP, with the "(nonhkip)" name
      // marker as a fallback when the IP is missing.
      ipExport: pkg.ipExport?.trim() || null,
      isNonHkIp: isNonHkExit(pkg),
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
    packageInfoList: {
      packageCode: string;
      count: number;
      price: number;
      periodNum?: number | null;
    }[];
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

  /** Current unit price of one package (1/10 000 USD), or null if unknown. */
  async getLivePackagePrice(packageCode: string): Promise<number | null> {
    const baseUrl = this.configService.getOrThrow('esimAccess.baseUrl', {
      infer: true,
    });
    const accessCode = this.configService.getOrThrow('esimAccess.accessCode', {
      infer: true,
    });
    const { data } = await firstValueFrom(
      this.httpService.post<EsimAccessApiResponse>(
        `${baseUrl}/api/v1/open/package/list`,
        { locationCode: '', type: '', packageCode, iccid: '' },
        {
          headers: {
            'RT-AccessCode': accessCode,
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    if (!data.success) return null;
    const pkg = (data.obj?.packageList ?? []).find(
      (p) => p.packageCode === packageCode,
    );
    return pkg && Number.isFinite(Number(pkg.price)) ? Number(pkg.price) : null;
  }

  /**
   * Order plans from eSIM Access with an amount it accepts (#013, round 4):
   * day passes are charged for every day (see `buildEsimAccessOrder`), and
   * when eSIM Access still says the amount is wrong — its price moved since
   * the last catalogue sync — the live prices are read and the order is sent
   * once more, rather than leaving a paid order with nothing ordered.
   */
  async submitPlanOrder(params: {
    transactionId: string;
    lines: EsimAccessOrderLine[];
  }): Promise<EsimAccessOrderResponse['obj']> {
    const first = buildEsimAccessOrder(params.lines);
    try {
      return await this.submitOrder({
        transactionId: params.transactionId,
        ...first,
      });
    } catch (err) {
      if (!isAmountMismatch(err)) throw err;
      this.logger.warn(
        `EsimAccess refused the amount for ${params.transactionId}; retrying with live prices`,
      );
      const live = await Promise.all(
        params.lines.map(async (line) => {
          const price = await this.getLivePackagePrice(line.packageCode);
          return price == null
            ? line
            : { ...line, unitPriceUsd: price / 10000 };
        }),
      );
      return this.submitOrder({
        transactionId: params.transactionId,
        ...buildEsimAccessOrder(live),
      });
    }
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

  async cancelEsim(esimTranNo: string): Promise<void> {
    const baseUrl = this.configService.getOrThrow('esimAccess.baseUrl', {
      infer: true,
    });
    const accessCode = this.configService.getOrThrow('esimAccess.accessCode', {
      infer: true,
    });

    this.logger.log(`Cancelling EsimAccess eSIM: esimTranNo=${esimTranNo}`);

    const { data } = await firstValueFrom(
      this.httpService.post(
        `${baseUrl}/api/v1/open/esim/cancel`,
        { esimTranNo },
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
        `EsimAccess cancel failed: ${data.errorCode} - ${data.errorMsg}`,
      );
    }

    this.logger.log(`EsimAccess eSIM cancelled: esimTranNo=${esimTranNo}`);
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

  /**
   * Fetch the list of topup packages eligible for a specific iccid.
   *
   * EsimAccess returns the global package catalogue when called with an
   * `iccid`; the partner side filters server-side to packages compatible
   * with that SIM (matching `supportTopUpType=2` and matching location).
   */
  async listTopupPackagesByIccid(iccid: string): Promise<EsimAccessPackage[]> {
    const baseUrl = this.configService.getOrThrow('esimAccess.baseUrl', {
      infer: true,
    });
    const accessCode = this.configService.getOrThrow('esimAccess.accessCode', {
      infer: true,
    });

    this.logger.log(`Fetching EsimAccess topup packages for iccid=${iccid}`);

    const { data } = await firstValueFrom(
      this.httpService.post<EsimAccessApiResponse>(
        `${baseUrl}/api/v1/open/package/list`,
        {
          locationCode: '',
          type: 'TOPUP',
          packageCode: '',
          iccid,
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
        `EsimAccess topup list failed: ${data.errorCode} - ${data.errorMsg}`,
      );
    }

    return data.obj?.packageList ?? [];
  }

  /**
   * Submit a topup for an existing EsimAccess SIM.
   * @see EsimAccess docs: POST /api/v1/open/esim/topup
   */
  async submitTopup(params: {
    iccid: string;
    packageCode: string;
    transactionId: string;
  }): Promise<EsimAccessTopupResponse['obj']> {
    const baseUrl = this.configService.getOrThrow('esimAccess.baseUrl', {
      infer: true,
    });
    const accessCode = this.configService.getOrThrow('esimAccess.accessCode', {
      infer: true,
    });

    const body: EsimAccessTopupRequest = {
      iccid: params.iccid,
      packageCode: params.packageCode,
      transactionId: params.transactionId,
    };

    this.logger.log(
      `Submitting EsimAccess topup: iccid=${params.iccid}, packageCode=${params.packageCode}, txn=${params.transactionId}`,
    );

    const { data } = await firstValueFrom(
      this.httpService.post<EsimAccessTopupResponse>(
        `${baseUrl}/api/v1/open/esim/topup`,
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
        `EsimAccess topup failed: ${data.errorCode} - ${data.errorMsg}`,
      );
    }

    this.logger.log(
      `EsimAccess topup submitted: orderNo=${data.obj?.orderNo ?? '-'}`,
    );

    return data.obj ?? {};
  }

  private buildPlanSlug(
    locationName: string,
    dataMb: number,
    days: number,
    provider: string,
    type: string,
    pkg?: EsimAccessPackage,
  ): string {
    const prefix = provider.substring(0, 2).toLowerCase();
    const dataLabel =
      dataMb > 0
        ? `-${this.formatDataSize(dataMb * 1024 * 1024).toLowerCase()}`
        : '';

    // Bug 4.1 fix: Use locationCode to differentiate Destination vs Region plans
    // Region plans have locationCode like "CN-3", "EU", "ASIA" (contains dash or multiple chars)
    // Destination plans have simple ISO codes like "CN", "US", "JP"
    if (pkg) {
      const locationCodes = pkg.location.split(',').map((s) => s.trim());
      const isRegionPackage = locationCodes.length > 1;

      if (isRegionPackage) {
        // Region plan: use locationCode directly (e.g., CN-3, EU, ASIA)
        const regionCode = pkg.locationCode
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '');
        return `${regionCode}${dataLabel}-${days}days-${type}-${prefix}`;
      } else {
        // Destination plan: use the simple country code
        const countryCode = pkg.locationCode
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        return `${countryCode}${dataLabel}-${days}days-${type}-${prefix}`;
      }
    }

    // Fallback for legacy calls without pkg
    const name = locationName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
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

/** Slug ending of the regular twin of a "(nonhkip)" package (vande #017). */
export const HK_TWIN_SLUG_SUFFIX = '-hkip';

function isNonhkipNamed(pkg: { name?: string | null; slug?: string | null }) {
  return /nonhkip/i.test(`${pkg.name ?? ''} ${pkg.slug ?? ''}`);
}

function fupGroup(fupPolicy: string | null | undefined): string {
  const lower = (fupPolicy ?? '').toLowerCase().trim();
  // 1 Mbps and up is its own kind of plan; anything slower is one group.
  const mbpsMatch = lower.match(/^([\d.]+)\s*mbps$/);
  if (mbpsMatch && parseFloat(mbpsMatch[1]) >= 1) return fupPolicy ?? '';
  return 'sub1mbps';
}

/**
 * Which esimaccess packages to sync (vande #017).
 *
 * esimaccess sells many offers twice: a regular package (e.g. China 1GB/Day,
 * PVG1G9ZU2, $0.80) and a "(nonhkip)" one that exits outside Hong Kong so
 * TikTok and ChatGPT work (P03XQE2SQ, $0.92). Sync used to keep ONLY the
 * nonhkip one, so the cheaper regular price never reached the price comparison
 * and most esimaccess offers lost to other suppliers. Now both are kept: the
 * regular one competes on price for every customer, the nonhkip one is what
 * the "TikTok & AI" filter offers.
 *
 * The nonhkip package keeps the slug it always had (links and existing plans
 * stay put); its regular twin gets {@link HK_TWIN_SLUG_SUFFIX}, since both
 * would otherwise build the same slug. Other duplicates with the same specs
 * are still dropped, keeping the first as before.
 */
export function pairNonhkipVariants(
  packages: EsimAccessPackage[],
): { pkg: EsimAccessPackage; slugSuffix: string }[] {
  const grouped = new Map<string, EsimAccessPackage[]>();
  for (const pkg of packages) {
    const key = `${pkg.locationCode}_${pkg.volume}_${pkg.duration}_${pkg.dataType}_${fupGroup(pkg.fupPolicy)}`;
    const group = grouped.get(key) ?? [];
    group.push(pkg);
    grouped.set(key, group);
  }

  const result: { pkg: EsimAccessPackage; slugSuffix: string }[] = [];
  for (const group of grouped.values()) {
    const nonhkip = group.find(isNonhkipNamed);
    const regular = group.find((p) => !isNonhkipNamed(p));
    if (nonhkip) result.push({ pkg: nonhkip, slugSuffix: '' });
    if (regular) {
      result.push({
        pkg: regular,
        slugSuffix: nonhkip ? HK_TWIN_SLUG_SUFFIX : '',
      });
    }
  }
  return result;
}

/**
 * Whether an esimaccess package's traffic leaves outside Hong Kong (#043, test
 * round 4). `ipExport` is "SG", "FR/NL/UK", "HK"…; HK anywhere in it means
 * TikTok and ChatGPT are blocked. With no IP reported, the "(nonhkip)" marker in
 * the name or slug is the only signal.
 */
export function isNonHkExit(pkg: {
  ipExport?: string | null;
  name?: string | null;
  slug?: string | null;
}): boolean {
  const ip = (pkg.ipExport ?? '').trim();
  if (ip) {
    return !ip.split(/[\/,\s]+/).some((part) => part.toUpperCase() === 'HK');
  }
  return isNonhkipNamed(pkg);
}
