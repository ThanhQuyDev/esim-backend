import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { UpdateProfitMarginDto } from './dto/update-profit-margin.dto';
import { NullableType } from '../utils/types/nullable.type';
import { ProfitMarginRepository } from './infrastructure/persistence/profit-margin.repository';
import { ProfitMargin } from './domain/profit-margin';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class ProfitMarginsService {
  constructor(
    private readonly profitMarginRepository: ProfitMarginRepository,
    @Inject(forwardRef(() => PlansService))
    private readonly plansService: PlansService,
  ) {}

  async getSingleton(): Promise<NullableType<ProfitMargin>> {
    const results = await this.profitMarginRepository.findManyWithPagination({
      filterOptions: null,
      sortOptions: null,
      paginationOptions: { page: 1, limit: 1 },
    });
    return results[0] ?? null;
  }

  async upsert(updateDto: UpdateProfitMarginDto): Promise<ProfitMargin> {
    const existing = await this.getSingleton();
    const oldPercentage = existing ? Number(existing.percentage) : null;

    let result: ProfitMargin;
    if (existing) {
      result = (await this.profitMarginRepository.update(existing.id, {
        name: updateDto.name,
        percentage: updateDto.percentage,
        isActive: updateDto.isActive,
      })) as ProfitMargin;
    } else {
      result = await this.profitMarginRepository.create({
        name: updateDto.name ?? 'Default Margin',
        percentage: updateDto.percentage ?? 0,
        isActive: updateDto.isActive ?? true,
      });
    }

    const newPercentage = Number(result.percentage);
    if (oldPercentage !== newPercentage) {
      await this.plansService.recalculatePrices(newPercentage);
    }

    return result;
  }

  async getActivePercentage(): Promise<number> {
    const results = await this.profitMarginRepository.findManyWithPagination({
      filterOptions: { isActive: true },
      sortOptions: null,
      paginationOptions: { page: 1, limit: 1 },
    });
    return results.length > 0 ? Number(results[0].percentage) : 0;
  }
}
