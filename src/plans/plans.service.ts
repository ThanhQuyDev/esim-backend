import {
  HttpStatus,
  Injectable,
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

@Injectable()
export class PlansService {
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
      dataGb: createPlanDto.dataGb,
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
      isActive: createPlanDto.isActive ?? true,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterPlanDto | null;
    sortOptions?: SortPlanDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<Plan[]> {
    return this.plansRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
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
      dataGb: updatePlanDto.dataGb,
      costPrice: updatePlanDto.costPrice,
      price: updatePlanDto.price,
      retailPrice: updatePlanDto.retailPrice,
      currency: updatePlanDto.currency,
      type: updatePlanDto.type,
      topUp: updatePlanDto.topUp,
      isActive: updatePlanDto.isActive,
    });
  }

  async markCheapestPlans(): Promise<void> {
    await this.plansRepository.markCheapestPlans();
  }

  async findPlansByDestination(slug: string): Promise<{
    dataPlans: Plan[];
    slowUnlimited: Plan[];
    fastUnlimited: Plan[];
    dailyUnlimited: Plan[];
  }> {
    const destination = await this.destinationsService.findBySlug(slug);
    if (!destination) {
      throw new NotFoundException('Destination not found');
    }

    const all = await this.plansRepository.findManyWithPagination({
      filterOptions: { destinationId: destination.id, isActive: true },
      paginationOptions: { page: 1, limit: 1000 },
    });

    const parseFupMbps = (fupSpeed: string | null): number => {
      if (!fupSpeed) return 0;
      const match = fupSpeed.match(/([\d.]+)\s*([MmGg]bps)/i);
      if (!match) return 0;
      const val = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      return unit === 'gbps' ? val * 1000 : val;
    };

    return {
      // Group 1: data-in-total, cheapest only
      dataPlans: all.filter((p) => p.type === 'data-in-total' && p.isCheapest),
      // Group 2: daily-limit-speed-reduced with fupSpeed < 1 Mbps
      slowUnlimited: all.filter(
        (p) =>
          p.type === 'daily-limit-speed-reduced' &&
          parseFupMbps(p.fupSpeed) < 1,
      ),
      // Group 3: daily-limit-speed-reduced with fupSpeed >= 1 Mbps
      fastUnlimited: all.filter(
        (p) =>
          p.type === 'daily-limit-speed-reduced' &&
          parseFupMbps(p.fupSpeed) >= 1,
      ),
      // Group 4: daily-unlimited
      dailyUnlimited: all.filter((p) => p.type === 'daily-unlimited'),
    };
  }

  async findPlansByRegion(slug: string): Promise<{
    dataPlans: Plan[];
    slowUnlimited: Plan[];
    fastUnlimited: Plan[];
    dailyUnlimited: Plan[];
  }> {
    const region = await this.regionsService.findBySlug(slug);
    if (!region) {
      throw new NotFoundException('Region not found');
    }

    const all = await this.plansRepository.findManyWithPagination({
      filterOptions: { regionId: region.id, isActive: true },
      paginationOptions: { page: 1, limit: 1000 },
    });

    const parseFupMbps = (fupSpeed: string | null): number => {
      if (!fupSpeed) return 0;
      const match = fupSpeed.match(/([\d.]+)\s*([MmGg]bps)/i);
      if (!match) return 0;
      const val = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      return unit === 'gbps' ? val * 1000 : val;
    };

    return {
      dataPlans: all.filter((p) => p.type === 'data-in-total' && p.isCheapest),
      slowUnlimited: all.filter(
        (p) =>
          p.type === 'daily-limit-speed-reduced' &&
          parseFupMbps(p.fupSpeed) < 1,
      ),
      fastUnlimited: all.filter(
        (p) =>
          p.type === 'daily-limit-speed-reduced' &&
          parseFupMbps(p.fupSpeed) >= 1,
      ),
      dailyUnlimited: all.filter((p) => p.type === 'daily-unlimited'),
    };
  }

  async remove(id: Plan['id']): Promise<void> {
    await this.plansRepository.remove(id);
  }
}
