import { Injectable } from '@nestjs/common';
import { CreateProfitMarginDto } from './dto/create-profit-margin.dto';
import { UpdateProfitMarginDto } from './dto/update-profit-margin.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterProfitMarginDto, SortProfitMarginDto } from './dto/query-profit-margin.dto';
import { ProfitMarginRepository } from './infrastructure/persistence/profit-margin.repository';
import { ProfitMargin } from './domain/profit-margin';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class ProfitMarginsService {
  constructor(private readonly profitMarginRepository: ProfitMarginRepository) {}

  async create(createDto: CreateProfitMarginDto): Promise<ProfitMargin> {
    return this.profitMarginRepository.create({
      name: createDto.name,
      percentage: createDto.percentage,
      isActive: createDto.isActive ?? true,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProfitMarginDto | null;
    sortOptions?: SortProfitMarginDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<ProfitMargin[]> {
    return this.profitMarginRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: ProfitMargin['id']): Promise<NullableType<ProfitMargin>> {
    return this.profitMarginRepository.findById(id);
  }

  async update(
    id: ProfitMargin['id'],
    updateDto: UpdateProfitMarginDto,
  ): Promise<ProfitMargin | null> {
    return this.profitMarginRepository.update(id, {
      name: updateDto.name,
      percentage: updateDto.percentage,
      isActive: updateDto.isActive,
    });
  }

  async getActivePercentage(): Promise<number> {
    const results = await this.profitMarginRepository.findManyWithPagination({
      filterOptions: { isActive: true },
      sortOptions: null,
      paginationOptions: { page: 1, limit: 1 },
    });
    return results.length > 0 ? Number(results[0].percentage) : 0;
  }

  async remove(id: ProfitMargin['id']): Promise<void> {
    await this.profitMarginRepository.remove(id);
  }
}
