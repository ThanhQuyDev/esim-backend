import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateProfitMarginTierDto } from './dto/create-profit-margin-tier.dto';
import { UpdateProfitMarginTierDto } from './dto/update-profit-margin-tier.dto';
import { NullableType } from '../utils/types/nullable.type';
import { ProfitMarginTierRepository } from './infrastructure/persistence/profit-margin-tier.repository';
import { ProfitMarginTier } from './domain/profit-margin-tier';
import { PlansService } from '../plans/plans.service';
import {
  FilterProfitMarginTierDto,
  SortProfitMarginTierDto,
} from './dto/query-profit-margin-tier.dto';
import { IPaginationOptions } from '../utils/types/pagination-options';

@Injectable()
export class ProfitMarginsService {
  constructor(
    private readonly tierRepository: ProfitMarginTierRepository,
    private readonly plansService: PlansService,
  ) {}

  // ── Tier CRUD ──────────────────────────────────────────────

  async createTier(dto: CreateProfitMarginTierDto): Promise<ProfitMarginTier> {
    await this.validateNoOverlap(dto.minVnd, dto.maxVnd);

    const tier = await this.tierRepository.create({
      minVnd: dto.minVnd,
      maxVnd: dto.maxVnd,
      percentage: dto.percentage,
      fixedAmountVnd: dto.fixedAmountVnd ?? 0,
      isActive: dto.isActive ?? true,
    });

    await this.recalculateAllPlanPrices();
    return tier;
  }

  async findManyTiers({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterProfitMarginTierDto | null;
    sortOptions?: SortProfitMarginTierDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<[ProfitMarginTier[], number]> {
    return this.tierRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  async findAllTiers(): Promise<ProfitMarginTier[]> {
    return this.tierRepository.findAll();
  }

  async findTierById(id: number): Promise<NullableType<ProfitMarginTier>> {
    return this.tierRepository.findById(id);
  }

  async updateTier(
    id: number,
    dto: UpdateProfitMarginTierDto,
  ): Promise<ProfitMarginTier> {
    const existing = await this.tierRepository.findById(id);
    if (!existing) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { id: 'tierNotFound' },
      });
    }

    const minVnd = dto.minVnd ?? existing.minVnd;
    const maxVnd = dto.maxVnd ?? existing.maxVnd;
    await this.validateNoOverlap(minVnd, maxVnd, id);

    const tier = (await this.tierRepository.update(id, {
      minVnd: dto.minVnd,
      maxVnd: dto.maxVnd,
      percentage: dto.percentage,
      fixedAmountVnd: dto.fixedAmountVnd,
      isActive: dto.isActive,
    })) as ProfitMarginTier;

    await this.recalculateAllPlanPrices();
    return tier;
  }

  async removeTier(id: number): Promise<void> {
    await this.tierRepository.remove(id);
    await this.recalculateAllPlanPrices();
  }

  // ── Overlap validation ─────────────────────────────────────

  private async validateNoOverlap(
    minVnd: number,
    maxVnd: number,
    excludeId?: number,
  ): Promise<void> {
    if (minVnd > maxVnd) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          range: 'minVnd must be less than or equal to maxVnd',
        },
      });
    }

    const overlapping = await this.tierRepository.findOverlapping(
      minVnd,
      maxVnd,
      excludeId,
    );

    if (overlapping.length > 0) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          range: `Price range overlaps with existing tier(s): ${overlapping.map((t) => `${t.minVnd}-${t.maxVnd}`).join(', ')}`,
        },
      });
    }
  }

  // ── Price calculation helpers ──────────────────────────────

  /**
   * Get the profit percentage for a given vndPrice based on active tiers.
   * Returns 0 if no tier matches.
   */
  async getProfitPercentageForVndPrice(vndPrice: number): Promise<number> {
    const tiers = await this.tierRepository.findAll();
    for (const tier of tiers) {
      if (vndPrice >= tier.minVnd && vndPrice <= tier.maxVnd) {
        return Number(tier.percentage);
      }
    }
    return 0;
  }

  /**
   * Calculate price from costPrice using tiered profit.
   * price = costPrice * (1 + matchingTierPercentage / 100)
   */
  async calculatePrice(costPrice: number, vndPrice: number): Promise<number> {
    const percentage = await this.getProfitPercentageForVndPrice(vndPrice);
    return Math.round(costPrice * (1 + percentage / 100) * 100) / 100;
  }

  /**
   * Compute the retail price in VND from a provider cost, applying the same
   * tiered profit margin used for SIM plans (see
   * PlanRepository.recalculatePricesByTiers), so topup pricing matches SIM
   * pricing exactly.
   *
   * Steps, mirroring the SIM SQL:
   *   1. Convert cost to VND (costUsd * rate).
   *   2. Match the tier whose [minVnd, maxVnd] contains that cost-in-VND.
   *   3. Apply the tier: fixedAmountVnd (added) takes precedence over
   *      percentage; no matching tier means no margin (cost passed through).
   *   4. Round to the nearest 1,000 VND (same unit as checkout charges).
   *
   * @param costUsd provider cost price in USD
   * @param rate    USD→VND exchange rate
   */
  async calculateRetailVndFromCostUsd(
    costUsd: number,
    rate: number,
  ): Promise<number> {
    const costVnd = costUsd * rate;
    const tiers = await this.tierRepository.findAll();

    let retailVnd = costVnd; // no-tier fallback: pass cost through
    for (const tier of tiers) {
      if (costVnd >= tier.minVnd && costVnd <= tier.maxVnd) {
        const fixed = Number(tier.fixedAmountVnd) || 0;
        retailVnd =
          fixed > 0
            ? costVnd + fixed
            : costVnd * (1 + Number(tier.percentage) / 100);
        break;
      }
    }

    // Round to the nearest 1,000 VND (matches VND_ROUNDING_UNIT at checkout).
    return Math.round(retailVnd / 1000) * 1000;
  }

  /**
   * Recalculate price and vndPrice for all plans based on current tiers.
   */
  async recalculateAllPlanPrices(): Promise<void> {
    const tiers = await this.tierRepository.findAll();
    const tierData = tiers.map((t) => ({
      minVnd: t.minVnd,
      maxVnd: t.maxVnd,
      percentage: Number(t.percentage),
      fixedAmountVnd: Number(t.fixedAmountVnd) || 0,
    }));
    await this.plansService.recalculatePricesWithTiers(tierData);
  }
}
