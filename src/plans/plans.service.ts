import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
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

function isStandardEsimPlan(plan: Plan): boolean {
  return !plan.isLocalInventory && !isSmsCallEsimPlan(plan);
}

function groupPlansBySimType(plans: Plan[]): PlanGroups {
  const standardPlans = plans.filter(isStandardEsimPlan);

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
      price: createPlanDto.price,
      retailPrice: createPlanDto.retailPrice,
      currency: createPlanDto.currency,
      type: createPlanDto.type ?? 'data-in-total',
      topUp: createPlanDto.topUp ?? false,
      speed: createPlanDto.speed ?? null,
      operatorName: createPlanDto.operatorName ?? null,
      fupSpeed: createPlanDto.fupSpeed ?? null,
      isAbleMultidate: createPlanDto.isAbleMultidate ?? false,
      isCheapest: false,
      discount: createPlanDto.discount ?? 0,
      vndPrice: createPlanDto.vndPrice ?? 0,
      isKyc: createPlanDto.isKyc ?? false,
      isLocalInventory: createPlanDto.isLocalInventory ?? false,
      apn: createPlanDto.apn ?? null,
      lastSyncedAt: createPlanDto.lastSyncedAt ?? null,
      isActive: createPlanDto.isActive ?? true,
      sms: createPlanDto.sms ?? null,
      call: createPlanDto.call ?? null,
    });
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
    });
  }

  async markCheapestPlans(): Promise<void> {
    await this.plansRepository.markCheapestPlans();
  }

  async recalculatePricesWithTiers(
    tiers: Array<{ minVnd: number; maxVnd: number; percentage: number }>,
  ): Promise<void> {
    await this.plansRepository.recalculatePricesByTiers(tiers);
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

    return groupPlansBySimType(all);
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

    return groupPlansBySimType(all);
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
