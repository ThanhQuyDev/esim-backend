import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterPlanDto, SortPlanDto } from './dto/query-plan.dto';
import { PlanRepository } from './infrastructure/persistence/plan.repository';
import { Plan } from './domain/plan';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { DestinationsService } from '../destinations/destinations.service';
import { RegionsService } from '../regions/regions.service';
import { ProfitMarginsService } from '../profit-margins/profit-margins.service';
import { ExchangeRateService, convertAmount } from './exchange-rate.service';
import { defaultDailyReset } from './plan-daily-reset';
import { ApnSupportService } from '../apn-support/apn-support.service';
import {
  activationDeadlineFromDays,
  activationDeadlineFromExpiry,
} from './plan-activation';

type PlanGroups = {
  dataPlans: Plan[];
  slowUnlimited: Plan[];
  fastUnlimited: Plan[];
  dailyUnlimited: Plan[];
  localEsim: Plan[];
  SmsCallEsim: Plan[];
  /**
   * Fixed-data plans that work with TikTok but lost the price de-duplication
   * (#067, rendered by #068).
   *
   * `markCheapestPlans` keeps one plan per destination + type + data + duration,
   * and the TikTok-capable variant is usually the dearer of the two — so it never
   * reached the storefront at all, and the "works with TikTok" filter could not
   * show it however it was written. They are returned in their own list rather
   * than mixed into `dataPlans`, so the default view stays exactly as it is today
   * and nothing else that reads `dataPlans` starts seeing extra plans.
   */
  tiktokHiddenByPrice: Plan[];
};

function hasPositivePlanValue(value: number | null | undefined): boolean {
  return Number(value ?? 0) > 0;
}

function isSmsCallEsimPlan(plan: Plan): boolean {
  return hasPositivePlanValue(plan.sms) || hasPositivePlanValue(plan.call);
}

/**
 * Chia gói thành các nhóm mà trang bán hàng hiển thị.
 *
 * Mốc phân chia là `isDomesticEsim`, **không phải** `isLocalInventory`. Hai cờ
 * này từng bị dùng lẫn nhau và hậu quả là 3 gói eSIM du lịch của Viettel bị
 * đẩy vào tab "eSIM nội địa", trong khi chúng phải nằm ở Quốc gia → Việt Nam
 * cùng mọi gói du lịch khác.
 *
 * - `isLocalInventory` = hàng mình giữ, giá niêm yết VND. Cả hai loại đều có.
 * - `isDomesticEsim`   = SIM data dùng trong nước, thuộc tab eSIM nội địa.
 *
 * Nên gói Viettel (`isLocalInventory = true`, `isDomesticEsim = false`) đi vào
 * `standardPlans` và hiện ở nhóm du lịch đúng theo `type` của nó.
 */
function groupPlansBySimType(plans: Plan[]): PlanGroups {
  const standardPlans = plans.filter(
    (p) => !p.isDomesticEsim && !isSmsCallEsimPlan(p),
  );

  return {
    dataPlans: standardPlans.filter((p) => p.type === 'fixed' && p.isCheapest),
    slowUnlimited: standardPlans.filter((p) => p.type === 'daily'),
    fastUnlimited: standardPlans.filter((p) => p.type === 'unlimited-reduce'),
    dailyUnlimited: standardPlans.filter((p) => p.type === 'unlimited'),
    localEsim: plans.filter((p) => p.isDomesticEsim),
    SmsCallEsim: plans.filter((p) => !p.isDomesticEsim && isSmsCallEsimPlan(p)),
    // Only the fixed-data group is de-duplicated by price, so only it can hide a
    // TikTok-capable plan. The unlimited groups are returned whole already.
    tiktokHiddenByPrice: standardPlans.filter(
      (p) =>
        p.type === 'fixed' &&
        !p.isCheapest &&
        p.appSupport?.tiktokAllDevices === true,
    ),
  };
}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly plansRepository: PlanRepository,
    private readonly destinationsService: DestinationsService,
    private readonly regionsService: RegionsService,
    @Inject(forwardRef(() => ProfitMarginsService))
    private readonly profitMarginsService: ProfitMarginsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly apnSupportService: ApnSupportService,
  ) {}

  /**
   * Cost / price / retail in BOTH currencies for one plan (#009).
   *
   * A supplier quotes in one currency only — dollars over its API, or đồng in
   * the Viettel and domestic-eSIM Excel upload — but the web has to compare and
   * total them together, so every plan stores both.
   */
  private async convertPlanMoney(input: {
    currency?: string | null;
    isLocalInventory?: boolean;
    costPrice?: number | null;
    price?: number | null;
    retailPrice?: number | null;
  }): Promise<{
    rate: number;
    costPrice: { vnd: number; usd: number };
    price: { vnd: number; usd: number };
    retailPrice: { vnd: number; usd: number };
  }> {
    const rate = await this.exchangeRateService.getUsdToVndRate();
    // Local inventory is quoted in đồng whatever the `currency` column says —
    // the Excel upload does not set it.
    const currency = input.isLocalInventory ? 'VND' : (input.currency ?? 'USD');
    return {
      rate,
      costPrice: convertAmount(input.costPrice, currency, rate),
      price: convertAmount(input.price, currency, rate),
      retailPrice: convertAmount(input.retailPrice, currency, rate),
    };
  }

  async create(createPlanDto: CreatePlanDto): Promise<Plan> {
    const existingBySlug = await this.plansRepository.findBySlug(
      createPlanDto.slug,
    );
    if (existingBySlug) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { slug: 'slugAlreadyExists' },
      });
    }

    const isLocalInventory = createPlanDto.isLocalInventory ?? false;
    // Mặc định false: một gói chỉ là "eSIM nội địa" khi người nhập nói vậy.
    // Suy ra từ `isLocalInventory` sẽ lặp lại đúng cái lỗi đã gộp eSIM du lịch
    // của Viettel vào tab nội địa.
    const isDomesticEsim = createPlanDto.isDomesticEsim ?? false;
    const supplierDailyReset = defaultDailyReset(
      createPlanDto.provider,
      isLocalInventory,
    );
    // Local/Viettel costs and prices are VND. Apply existing Margin Tiers at
    // creation time; previously tiers only recalculated plans that already
    // existed when the tier was saved.
    const localRetailVnd = isLocalInventory
      ? await this.profitMarginsService.calculateRetailVndFromLocalCost(
          createPlanDto.costPrice,
        )
      : null;

    // Both currencies, computed here rather than left to the hourly pass (#009).
    // A Viettel plan used to be stored with `usdPrice = 0` until that pass ran,
    // and `getPlanUsdPrice` then recorded 0 as the order total.
    const money = await this.convertPlanMoney({
      currency: createPlanDto.currency,
      isLocalInventory,
      costPrice: createPlanDto.costPrice,
      price: localRetailVnd ?? createPlanDto.price,
      retailPrice: localRetailVnd ?? createPlanDto.retailPrice,
    });

    return this.plansRepository.create({
      provider: createPlanDto.provider,
      providerPlanId: createPlanDto.providerPlanId,
      name: createPlanDto.name,
      slug: createPlanDto.slug,
      countryCode: createPlanDto.countryCode ?? null,
      destinationId: createPlanDto.destinationId ?? null,
      regionId: createPlanDto.regionId ?? null,
      durationDays: createPlanDto.durationDays,
      dataMb: createPlanDto.dataMb,
      costPrice: createPlanDto.costPrice,
      price: localRetailVnd ?? createPlanDto.price,
      retailPrice: localRetailVnd ?? createPlanDto.retailPrice,
      currency: createPlanDto.currency,
      type: createPlanDto.type ?? 'data-in-total',
      topUp: createPlanDto.topUp ?? false,
      speed: createPlanDto.speed ?? null,
      operatorName: createPlanDto.operatorName ?? null,
      fupSpeed: createPlanDto.fupSpeed ?? null,
      isAbleMultidate: createPlanDto.isAbleMultidate ?? false,
      isCheapest: false,
      discount: createPlanDto.discount ?? 0,
      vndPrice: localRetailVnd ?? createPlanDto.vndPrice ?? money.price.vnd,
      usdPrice: money.price.usd,
      usdCostPrice: money.costPrice.usd,
      usdRetailPrice: money.retailPrice.usd,
      vndCostPrice: money.costPrice.vnd,
      vndRetailPrice: money.retailPrice.vnd,
      isNonHkIp: createPlanDto.isNonHkIp ?? false,
      isKyc: createPlanDto.isKyc ?? false,
      isLocalInventory,
      isDomesticEsim,
      tags: createPlanDto.tags ?? null,
      apn: createPlanDto.apn ?? null,
      activationValidityDays: createPlanDto.activationValidityDays ?? null,
      // What the supplier resets by, unless the caller stated it outright
      // (#063). Falling back to the supplier default means a plan typed in by
      // hand is as informative as a synced one.
      dailyResetPolicy:
        createPlanDto.dailyResetPolicy ??
        supplierDailyReset?.dailyResetPolicy ??
        null,
      dailyResetUtcOffset:
        createPlanDto.dailyResetUtcOffset ??
        supplierDailyReset?.dailyResetUtcOffset ??
        null,
      hotSpot: createPlanDto.hotSpot ?? false,
      hotSpotAllow: createPlanDto.hotSpotAllow ?? null,
      lastSyncedAt: createPlanDto.lastSyncedAt ?? null,
      isActive: createPlanDto.isActive ?? true,
      sms: createPlanDto.sms ?? null,
      call: createPlanDto.call ?? null,
    });
  }

  /**
   * Retail VND for a local-inventory plan at this cost, with the current margin
   * tier applied — the same price {@link create} gives a brand-new plan. Used
   * when an eSIM re-upload changes the cost of a plan that already exists.
   */
  localRetailVnd(costVnd: number): Promise<number> {
    return this.profitMarginsService.calculateRetailVndFromLocalCost(costVnd);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterPlanDto | null;
    sortOptions?: SortPlanDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[Plan[], number]> {
    const [plans, count] = await this.plansRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });

    await this.enrichPlansWithRegionDestinations(plans);
    return [plans, count];
  }

  private async enrichPlansWithRegionDestinations(
    plans: Plan[],
  ): Promise<void> {
    const regionIds = [
      ...new Set(
        plans.filter((p) => p.regionId).map((p) => p.regionId as number),
      ),
    ];
    if (!regionIds.length) return;

    const regionMap = new Map<number, any>();
    for (const regionId of regionIds) {
      const region = await this.regionsService.findById(regionId);
      if (region) {
        regionMap.set(regionId, region);
      }
    }

    for (const plan of plans) {
      if (plan.regionId && regionMap.has(plan.regionId)) {
        plan.region = regionMap.get(plan.regionId);
      }
    }
  }

  findById(id: Plan['id']): Promise<NullableType<Plan>> {
    return this.plansRepository.findById(id);
  }

  findBySlug(slug: Plan['slug']): Promise<NullableType<Plan>> {
    return this.plansRepository.findBySlug(slug);
  }

  /** The live row a supplier sync last wrote for this provider plan id. */
  findByProviderPlanId(
    provider: string,
    providerPlanId: string,
  ): Promise<NullableType<Plan>> {
    return this.plansRepository.findByProviderPlanId(provider, providerPlanId);
  }

  /**
   * A slug for a synced plan that no OTHER provider plan holds — soft-deleted
   * rows included, since the unique index covers them too. Tries `base`, then
   * `base-<last 6 of the id>`, then `base-<id>`.
   */
  async uniqueSyncedPlanSlug(
    base: string,
    provider: string,
    providerPlanId: string,
  ): Promise<string> {
    const tail = providerPlanId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    for (const suffix of ['', `-${tail.slice(-6)}`, `-${tail}`]) {
      const slug = `${base}${suffix}`;
      const owner = await this.plansRepository.slugOwner(slug);
      if (
        !owner ||
        (owner.provider === provider &&
          owner.providerPlanId === providerPlanId &&
          !owner.deletedAt)
      ) {
        return slug;
      }
    }
    return `${base}-${tail}-${Date.now().toString(36)}`;
  }

  async update(
    id: Plan['id'],
    updatePlanDto: UpdatePlanDto,
  ): Promise<Plan | null> {
    if (updatePlanDto.slug) {
      const existingBySlug = await this.plansRepository.findBySlug(
        updatePlanDto.slug,
      );
      if (existingBySlug && existingBySlug.id !== Number(id)) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { slug: 'slugAlreadyExists' },
        });
      }
    }

    // An admin editing a price must not leave the converted columns behind
    // (#009). The current row supplies whatever the payload leaves out, since a
    // partial edit still has to convert a complete set of three amounts.
    const current = await this.plansRepository.findById(id);
    const touchesMoney =
      updatePlanDto.costPrice !== undefined ||
      updatePlanDto.price !== undefined ||
      updatePlanDto.retailPrice !== undefined ||
      updatePlanDto.currency !== undefined ||
      updatePlanDto.isLocalInventory !== undefined;
    const money = touchesMoney
      ? await this.convertPlanMoney({
          currency: updatePlanDto.currency ?? current?.currency,
          isLocalInventory:
            updatePlanDto.isLocalInventory ??
            current?.isLocalInventory ??
            false,
          costPrice: updatePlanDto.costPrice ?? current?.costPrice,
          price: updatePlanDto.price ?? current?.price,
          retailPrice: updatePlanDto.retailPrice ?? current?.retailPrice,
        })
      : null;

    return this.plansRepository.update(id, {
      provider: updatePlanDto.provider,
      providerPlanId: updatePlanDto.providerPlanId,
      name: updatePlanDto.name,
      slug: updatePlanDto.slug,
      countryCode: updatePlanDto.countryCode,
      destinationId: updatePlanDto.destinationId,
      regionId: updatePlanDto.regionId,
      durationDays: updatePlanDto.durationDays,
      dataMb: updatePlanDto.dataMb,
      costPrice: updatePlanDto.costPrice,
      price: updatePlanDto.price,
      retailPrice: updatePlanDto.retailPrice,
      currency: updatePlanDto.currency,
      type: updatePlanDto.type,
      topUp: updatePlanDto.topUp,
      speed: updatePlanDto.speed,
      operatorName: updatePlanDto.operatorName,
      fupSpeed: updatePlanDto.fupSpeed,
      isAbleMultidate: updatePlanDto.isAbleMultidate,
      discount: updatePlanDto.discount,
      isKyc: updatePlanDto.isKyc,
      isLocalInventory: updatePlanDto.isLocalInventory,
      isDomesticEsim: updatePlanDto.isDomesticEsim,
      apn: updatePlanDto.apn,
      lastSyncedAt: updatePlanDto.lastSyncedAt,
      isActive: updatePlanDto.isActive,
      sms: updatePlanDto.sms,
      call: updatePlanDto.call,
      // Bug fix — tags / vndPrice were missing from the update payload, so
      // edits from the admin grid silently dropped the new tag list and the
      // VND override. They're inherited from `PartialType(CreatePlanDto)` on
      // the DTO side, just need to be forwarded to the repository.
      tags: updatePlanDto.tags,
      vndPrice: updatePlanDto.vndPrice ?? money?.price.vnd,
      hotSpot: updatePlanDto.hotSpot,
      hotSpotAllow: updatePlanDto.hotSpotAllow,
      ...(money
        ? {
            usdPrice: money.price.usd,
            usdCostPrice: money.costPrice.usd,
            usdRetailPrice: money.retailPrice.usd,
            vndCostPrice: money.costPrice.vnd,
            vndRetailPrice: money.retailPrice.vnd,
          }
        : {}),
    });
  }

  /** Distinct APN values, for the CMS filter's select box (#010). */
  getDistinctApns(): Promise<string[]> {
    return this.plansRepository.getDistinctApns();
  }

  /** Recount units sold per plan, destination and region (#053). */
  async recalculateSoldCounts(): Promise<void> {
    await this.plansRepository.recalculateSoldCounts();
  }

  async markCheapestPlans(): Promise<void> {
    await this.plansRepository.markCheapestPlans();
  }

  /**
   * Take every plan of one supplier off sale (#005), remembering which rows this
   * did so switching the supplier back on can restore exactly them.
   *
   * @returns how many plans were deactivated
   */
  async deactivatePlansForProvider(provider: string): Promise<number> {
    return this.plansRepository.deactivatePlansForProvider(provider);
  }

  /** Put back only the plans {@link deactivatePlansForProvider} took down. */
  async reactivatePlansDisabledByProvider(provider: string): Promise<number> {
    return this.plansRepository.reactivatePlansDisabledByProvider(provider);
  }

  async recalculatePricesWithTiers(
    tiers: Array<{
      minVnd: number;
      maxVnd: number;
      percentage: number;
      fixedAmountVnd?: number;
    }>,
  ): Promise<void> {
    const rate = await this.exchangeRateService.getUsdToVndRate();

    // Step 1: Recalculate price from costPrice using tiers
    await this.plansRepository.recalculatePricesByTiers(tiers, rate);

    // Step 2: Update vndPrice from the new price (excludes isLocalInventory)
    await this.plansRepository.updateAllVndPrices(rate);

    // Step 3: Mark cheapest plans
    await this.plansRepository.markCheapestPlans();
  }

  async updateVndPrices(): Promise<void> {
    try {
      const rate = await this.exchangeRateService.getUsdToVndRate();
      await this.plansRepository.updateAllVndPrices(rate);
      this.logger.log(
        `Converted cost/price/retail for all plans (1 USD = ${rate} VND)`,
      );
    } catch (err) {
      this.logger.error('Failed to convert plan prices', err);
    }
  }

  /**
   * Tag plans with the two facts the storefront cannot work out for itself: how
   * many unsold eSIMs a local-inventory plan has left (#040), and the date the
   * eSIM has to be activated by (#070).
   *
   * Only local inventory can run out: every other provider mints an eSIM on
   * demand, so their plans are left without a stock figure rather than being
   * reported as "0 left" and dimmed by mistake.
   *
   * The deadline is counted from now because the ticket counts it from the moment
   * the customer looks at the product, which is this request.
   */
  private async attachStorefrontFacts(plans: Plan[]): Promise<Plan[]> {
    const now = new Date();
    const localPlanIds = plans
      .filter((plan) => plan.isLocalInventory)
      .map((plan) => Number(plan.id));

    const [stock, apnCapabilities] = await Promise.all([
      localPlanIds.length
        ? this.plansRepository.countAvailableEsimsByPlanIds(localPlanIds)
        : Promise.resolve({}),
      // One read of the APN table for the whole page, not one per plan (#067).
      this.apnSupportService.capabilityMap(),
    ]);

    return plans.map((plan) => {
      // Whether TikTok and ChatGPT work: the esimaccess "nonhkip" marker, or the
      // uploaded APN table for everybody else (#065, #067).
      const appSupport = this.apnSupportService.judgePlan(
        plan,
        apnCapabilities,
      );

      if (!plan.isLocalInventory) {
        return {
          ...plan,
          appSupport,
          activationDeadline: activationDeadlineFromDays(
            plan.activationValidityDays,
            now,
          ),
        };
      }

      const summary = stock[Number(plan.id)];
      return {
        ...plan,
        appSupport,
        availableStock: summary?.count ?? 0,
        // Local stock is already printed with its expiry, so the deadline is that
        // date rather than a count from today.
        activationDeadline: activationDeadlineFromExpiry(
          summary?.earliestExpiresAt,
          now,
        ),
      };
    });
  }

  async findPlansByDestination(slug: string): Promise<PlanGroups> {
    const destination = await this.destinationsService.findBySlug(slug);
    if (!destination) {
      throw new NotFoundException('Destination not found');
    }

    const [all] = await this.plansRepository.findManyWithPagination({
      filterOptions: { destinationId: destination.id, isActive: true },
      sortOptions: [{ orderBy: 'vndPrice', order: 'ASC' }],
      paginationOptions: { page: 1, limit: 1000 },
    });

    return groupPlansBySimType(await this.attachStorefrontFacts(all));
  }

  async findPlansByRegion(slug: string): Promise<PlanGroups> {
    const region = await this.regionsService.findBySlug(slug);
    if (!region) {
      throw new NotFoundException('Region not found');
    }

    const [all] = await this.plansRepository.findManyWithPagination({
      filterOptions: { regionId: region.id, isActive: true },
      sortOptions: [{ orderBy: 'vndPrice', order: 'ASC' }],
      paginationOptions: { page: 1, limit: 1000 },
    });

    return groupPlansBySimType(await this.attachStorefrontFacts(all));
  }

  /**
   * Các nhà mạng cho tab "eSIM nội địa".
   *
   * Gom theo `provider` từ các gói `isDomesticEsim` đang bán, nên thêm nhà mạng
   * mới không cần sửa code. `fromVndPrice` là giá thấp nhất của nhà mạng đó,
   * dùng cho nhãn "Từ {n}đ".
   *
   * Lọc theo `isDomesticEsim` chứ không phải `isLocalInventory`: nếu lọc theo
   * cờ sau thì Viettel — nhà mạng chỉ bán eSIM du lịch — sẽ hiện thành một thẻ
   * nhà mạng nội địa.
   */
  async listLocalCarriers(): Promise<
    { provider: string; fromVndPrice: number; planCount: number }[]
  > {
    return this.plansRepository.getLocalCarriers();
  }

  /**
   * Toàn bộ gói eSIM nội địa đang bán của một nhà mạng, cho trang
   * /esim-noi-dia/[carrier]. Ném NotFound khi nhà mạng đó không có gói nội địa
   * nào — kể cả khi họ có gói du lịch, vì trang này không nói về gói du lịch.
   */
  async findLocalPlansByCarrier(provider: string): Promise<PlanGroups> {
    const [all] = await this.plansRepository.findManyWithPagination({
      filterOptions: {
        provider: [provider],
        isDomesticEsim: true,
        isActive: true,
      },
      sortOptions: [{ orderBy: 'vndPrice', order: 'ASC' }],
      paginationOptions: { page: 1, limit: 1000 },
    });

    if (all.length === 0) {
      throw new NotFoundException(
        `No domestic eSIM plans found for carrier '${provider}'`,
      );
    }

    return groupPlansBySimType(await this.attachStorefrontFacts(all));
  }

  async batchUpdateDiscount(ids: number[], discount: number): Promise<void> {
    await this.plansRepository.batchUpdateDiscount(ids, discount);
  }

  async remove(id: Plan['id']): Promise<void> {
    await this.plansRepository.remove(id);
  }

  async deactivateStaleProviderPlans(
    provider: string,
    syncStartedAt: Date,
  ): Promise<void> {
    await this.plansRepository.deactivateStaleProviderPlans(
      provider,
      syncStartedAt,
    );
  }

  /**
   * Soft-delete the rows an older catalogue mapping left behind, once this
   * sync has written their provider plan id onto a fresh row. Returns how
   * many went.
   */
  async softDeleteSupersededProviderPlans(
    provider: string,
    syncStartedAt: Date,
  ): Promise<number> {
    return this.plansRepository.softDeleteSupersededProviderPlans(
      provider,
      syncStartedAt,
    );
  }

  async deactivateAllProviderPlans(provider: string): Promise<void> {
    await this.plansRepository.deactivateAllProviderPlans(provider);
  }

  async refreshProviders(): Promise<void> {
    // Collect all distinct destination IDs and region IDs from active plans
    const [plans] = await this.plansRepository.findManyWithPagination({
      filterOptions: { isActive: true },
      paginationOptions: { page: 1, limit: 100000 },
    });

    const destinationIds = [
      ...new Set(plans.map((p) => p.destinationId).filter(Boolean)),
    ] as number[];
    const regionIds = [
      ...new Set(plans.map((p) => p.regionId).filter(Boolean)),
    ] as number[];

    // Update providers for each destination
    for (const destId of destinationIds) {
      const providers =
        await this.plansRepository.getDistinctProvidersByDestinationId(destId);
      await this.destinationsService.updateProviders(
        destId,
        providers.length > 0 ? providers.join(',') : null,
      );
    }

    // Update providers for each region
    for (const regionId of regionIds) {
      const providers =
        await this.plansRepository.getDistinctProvidersByRegionId(regionId);
      await this.regionsService.updateProviders(
        regionId,
        providers.length > 0 ? providers.join(',') : null,
      );
    }

    this.logger.log(
      `Refreshed providers for ${destinationIds.length} destinations and ${regionIds.length} regions`,
    );
  }
}
