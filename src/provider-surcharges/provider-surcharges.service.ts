import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OVERVIEW_PROVIDERS } from '../overview/dto/overview.dto';
import { PlansService } from '../plans/plans.service';
import {
  ProviderSurchargeDto,
  UpsertProviderSurchargeDto,
} from './dto/provider-surcharge.dto';
import { ProviderSurchargeEntity } from './infrastructure/persistence/relational/entities/provider-surcharge.entity';

const PROVIDER_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * Tax / fee per supplier, applied when the cheapest plan is picked (#049).
 *
 * Only the COMPARISON uses it — the price a customer pays is still set by the
 * profit-margin tiers. A supplier with no row is compared at its listed cost.
 */
@Injectable()
export class ProviderSurchargesService {
  constructor(
    @InjectRepository(ProviderSurchargeEntity)
    private readonly repository: Repository<ProviderSurchargeEntity>,
    private readonly plansService: PlansService,
  ) {}

  private normalizeProvider(provider: string): string {
    const slug = (provider ?? '').trim().toLowerCase();
    if (!PROVIDER_SLUG.test(slug)) {
      throw new BadRequestException(`Invalid provider "${provider}"`);
    }
    return slug;
  }

  /** Every known supplier, with its surcharge (0 when none is set). */
  async list(): Promise<ProviderSurchargeDto[]> {
    const [rows, counts] = await Promise.all([
      this.repository.find(),
      this.repository.manager.query(
        `SELECT "provider", COUNT(*) AS "count" FROM "plan"
         WHERE "deletedAt" IS NULL AND "isActive" = true
         GROUP BY "provider"`,
      ) as Promise<{ provider: string; count: string | number }[]>,
    ]);

    const bySlug = new Map(rows.map((row) => [row.provider, row]));
    const countBySlug = new Map(
      counts
        .filter((row) => !!row.provider)
        .map((row) => [row.provider.toLowerCase(), Number(row.count) || 0]),
    );
    const providers = new Set<string>([
      ...OVERVIEW_PROVIDERS,
      ...countBySlug.keys(),
      ...bySlug.keys(),
    ]);

    return Array.from(providers)
      .sort((a, b) => a.localeCompare(b))
      .map((provider) =>
        this.toDto(provider, bySlug.get(provider), countBySlug.get(provider)),
      );
  }

  async upsert(
    provider: string,
    dto: UpsertProviderSurchargeDto,
  ): Promise<ProviderSurchargeDto> {
    const slug = this.normalizeProvider(provider);

    await this.repository.save(
      this.repository.create({
        provider: slug,
        percentage: dto.percentage,
        note: dto.note?.trim() || null,
      }),
    );

    // Re-pick the cheapest plans now rather than at the next 6-hourly run, so
    // the admin sees the effect straight away.
    await this.plansService.markCheapestPlans();

    const row = (await this.list()).find((item) => item.provider === slug);
    return row ?? this.toDto(slug);
  }

  private toDto(
    provider: string,
    row?: ProviderSurchargeEntity,
    activePlanCount = 0,
  ): ProviderSurchargeDto {
    return {
      provider,
      percentage: Number(row?.percentage ?? 0) || 0,
      note: row?.note ?? null,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      activePlanCount,
    };
  }
}
