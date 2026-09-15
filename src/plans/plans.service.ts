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

type PlanGroups = {
  dataPlans: Plan[];
  slowUnlimited: Plan[];
  fastUnlimited: Plan[];
  dailyUnlimited: Plan[];
  localEsim: Plan[];
  SmsCallEsim: Plan[];
};

function hasPositivePlanValue(value: number | null | undefined): boolean {
  return Number(value ?? 0) > 0;
}

function isSmsCallEsimPlan(plan: Plan): boolean {
  return hasPositivePlanValue(plan.sms) || hasPositivePlanValue(plan.call);
}

function groupPlansBySimType(plans: Plan[]): PlanGroups {
  const standardPlans = plans.filter(
    (p) => !p.isLocalInventory && !isSmsCallEsimPlan(p),
  );

  return {
    dataPlans: standardPlans.filter((p) => p.type === 'fixed' && p.isCheapest),
    slowUnlimited: standardPlans.filter((p) => p.type === 'daily'),
    fastUnlimited: standardPlans.filter((p) => p.type === 'unlimited-reduce'),
    dailyUnlimited: standardPlans.filter((p) => p.type === 'unlimited'),
    localEsim: plans.filter((p) => p.isLocalInventory),
    SmsCallEsim: plans.filter(
      (p) => !p.isLocalInventory && isSmsCallEsimPlan(p),
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
  ) {}

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
    // Local/Viettel costs and prices are VND. Apply existing Margin Tiers at
    // creation time; previously tiers only recalculated plans that already
    // existed when the tier was saved.
    const localRetailVnd = isLocalInventory
      ? await this.profitMarginsService.calculateRetailVndFromLocalCost(
          createPlanDto.costPrice,
        )
      : null;

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
      vndPrice: localRetailVnd ?? createPlanDto.vndPrice ?? 0,
      // Local inventory is priced in VND, so `price` is NOT dollars for it;
      // the hourly exchange-rate job fills usdPrice in on its next run.
      usdPrice: isLocalInventory ? 0 : (createPlanDto.price ?? 0),
      isNonHkIp: createPlanDto.isNonHkIp ?? false,
      isKyc: createPlanDto.isKyc ?? false,
      isLocalInventory,
      tags: createPlanDto.tags ?? null,
      apn: createPlanDto.apn ?? null,
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
      vndPrice: updatePlanDto.vndPrice,
      hotSpot: updatePlanDto.hotSpot,
      hotSpotAllow: updatePlanDto.hotSpotAllow,
    });
  }

  /** Recount units sold per plan, destination and region (#053). */
  async recalculateSoldCounts(): Promise<void> {
    await this.plansRepository.recalculateSoldCounts();
  }

  async markCheapestPlans(): Promise<void> {
    await this.plansRepository.markCheapestPlans();
  }

  async recalculatePricesWithTiers(
    tiers: Array<{
      minVnd: number;
      maxVnd: number;
      percentage: number;
      fixedAmountVnd?: number;
    }>,
  ): Promise<void> {
    // Fetch current exchange rate for tier matching
    let rate = 25500;
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.VND) rate = data.rates.VND;
      }
    } catch {
      // Use default rate
    }

    // Step 1: Recalculate price from costPrice using tiers
    await this.plansRepository.recalculatePricesByTiers(tiers, rate);

    // Step 2: Update vndPrice from the new price (excludes isLocalInventory)
    await this.plansRepository.updateAllVndPrices(rate);

    // Step 3: Mark cheapest plans
    await this.plansRepository.markCheapestPlans();
  }

  async updateVndPrices(): Promise<void> {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) {
        this.logger.error(`Exchange rate API error: ${res.status}`);
        return;
      }

      const data = await res.json();
      const rate: number = data?.rates?.VND;
      if (!rate) {
        this.logger.error('VND rate not found in response');
        return;
      }

      await this.plansRepository.updateAllVndPrices(rate);
      this.logger.log(`Updated vndPrice for all plans (1 USD = ${rate} VND)`);
    } catch (err) {
      this.logger.error('Failed to update vndPrice', err);
    }
  }

  /**
   * Tag local-inventory plans with how many unsold eSIMs are left (#040).
   *
   * Only local inventory can run out: every other provider mints an eSIM on
   * demand, so their plans are left without a stock figure rather than being
   * reported as "0 left" and dimmed by mistake.
   */
  private async attachLocalStock(plans: Plan[]): Promise<Plan[]> {
    const localPlanIds = plans
      .filter((plan) => plan.isLocalInventory)
      .map((plan) => Number(plan.id));

    if (localPlanIds.length === 0) return plans;

    const stock =
      await this.plansRepository.countAvailableEsimsByPlanIds(localPlanIds);

    return plans.map((plan) =>
      plan.isLocalInventory
        ? { ...plan, availableStock: stock[Number(plan.id)] ?? 0 }
        : plan,
    );
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

    return groupPlansBySimType(await this.attachLocalStock(all));
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

    return groupPlansBySimType(await this.attachLocalStock(all));
  }

  /**
   * List the domestic (local-inventory) carriers for the "eSIM nội địa" tab.
   * Grouped dynamically from active `isLocalInventory` plans by `provider`, so
   * new carriers appear automatically without code changes. `fromVndPrice` is
   * the cheapest plan price per carrier for the "Từ {n}đ" card label.
   */
  async listLocalCarriers(): Promise<
    { provider: string; fromVndPrice: number; planCount: number }[]
  > {
    return this.plansRepository.getLocalCarriers();
  }

  /**
   * Fetch and group all active local-inventory plans for one carrier
   * (provider slug). Used by the /esim-noi-dia/[carrier] detail page.
   * Throws NotFound when the carrier has no active local plans.
   */
  async findLocalPlansByCarrier(provider: string): Promise<PlanGroups> {
    const [all] = await this.plansRepository.findManyWithPagination({
      filterOptions: {
        provider: [provider],
        isLocalInventory: true,
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

    return groupPlansBySimType(await this.attachLocalStock(all));
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
