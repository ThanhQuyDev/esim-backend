import { Injectable } from '@nestjs/common';
import { CreatePlanPriceDto } from './dto/create-plan-price.dto';
import { UpdatePlanPriceDto } from './dto/update-plan-price.dto';
import { NullableType } from '../utils/types/nullable.type';
import {
  FilterPlanPriceDto,
  SortPlanPriceDto,
} from './dto/query-plan-price.dto';
import { PlanPriceRepository } from './infrastructure/persistence/plan-price.repository';
import { PlanPrice } from './domain/plan-price';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class PlanPricesService {
  constructor(private readonly planPriceRepository: PlanPriceRepository) {}

  async create(createPlanPriceDto: CreatePlanPriceDto): Promise<PlanPrice> {
    return this.planPriceRepository.create({
      planId: createPlanPriceDto.planId,
      currency: createPlanPriceDto.currency,
      price: createPlanPriceDto.price,
      originalPrice: createPlanPriceDto.originalPrice ?? null,
      isActive: createPlanPriceDto.isActive ?? true,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterPlanPriceDto | null;
    sortOptions?: SortPlanPriceDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<PlanPrice[]> {
    return this.planPriceRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: PlanPrice['id']): Promise<NullableType<PlanPrice>> {
    return this.planPriceRepository.findById(id);
  }

  findByPlanIdAndCurrency(
    planId: PlanPrice['planId'],
    currency: PlanPrice['currency'],
  ): Promise<NullableType<PlanPrice>> {
    return this.planPriceRepository.findByPlanIdAndCurrency(planId, currency);
  }

  async update(
    id: PlanPrice['id'],
    updatePlanPriceDto: UpdatePlanPriceDto,
  ): Promise<PlanPrice | null> {
    return this.planPriceRepository.update(id, {
      planId: updatePlanPriceDto.planId,
      currency: updatePlanPriceDto.currency,
      price: updatePlanPriceDto.price,
      originalPrice: updatePlanPriceDto.originalPrice,
      isActive: updatePlanPriceDto.isActive,
    });
  }

  async remove(id: PlanPrice['id']): Promise<void> {
    await this.planPriceRepository.remove(id);
  }
}
