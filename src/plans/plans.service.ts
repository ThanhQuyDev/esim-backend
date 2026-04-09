import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterPlanDto, SortPlanDto } from './dto/query-plan.dto';
import { PlanRepository } from './infrastructure/persistence/plan.repository';
import { Plan } from './domain/plan';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class PlansService {
  constructor(private readonly plansRepository: PlanRepository) {}

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
      if (existingBySlug && existingBySlug.id !== id) {
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

  async remove(id: Plan['id']): Promise<void> {
    await this.plansRepository.remove(id);
  }
}
