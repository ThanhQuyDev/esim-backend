import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OVERVIEW_PROVIDERS } from '../overview/dto/overview.dto';
import { PlansService } from '../plans/plans.service';
import {
  ProviderSalesStatusDto,
  SetProviderSalesStatusDto,
} from './dto/provider-sales-status.dto';
import { ProviderSalesStatusEntity } from './infrastructure/persistence/relational/entities/provider-sales-status.entity';

const PROVIDER_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

interface PlanCounts {
  active: number;
  disabledByProvider: number;
}

/**
 * Switching a whole supplier off (#005).
 *
 * The point is speed: when a supplier breaks badly there is no time to walk a
 * thousand plans in the CMS, so one switch takes every plan it supplies off sale
 * — and switching it back on restores exactly the plans the switch took down,
 * never the ones an admin had deactivated deliberately.
 */
@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    @InjectRepository(ProviderSalesStatusEntity)
    private readonly repository: Repository<ProviderSalesStatusEntity>,
    private readonly plansService: PlansService,
  ) {}

  private normalizeProvider(provider: string): string {
    const slug = (provider ?? '').trim().toLowerCase();
    if (!PROVIDER_SLUG.test(slug)) {
      throw new BadRequestException(`Invalid provider "${provider}"`);
    }
    return slug;
  }

  private async planCounts(): Promise<Map<string, PlanCounts>> {
    const rows = (await this.repository.manager.query(
      `SELECT "provider",
              COUNT(*) FILTER (WHERE "isActive" = true) AS "active",
              COUNT(*) FILTER (WHERE "disabledByProvider" = true) AS "disabled"
       FROM "plan"
       WHERE "deletedAt" IS NULL
       GROUP BY "provider"`,
    )) as {
      provider: string;
      active: string | number;
      disabled: string | number;
    }[];

    return new Map(
      rows
        .filter((row) => !!row.provider)
        .map((row) => [
          row.provider.toLowerCase(),
          {
            active: Number(row.active) || 0,
            disabledByProvider: Number(row.disabled) || 0,
          },
        ]),
    );
  }

  /** Every known supplier with its on/off state. */
  async list(): Promise<ProviderSalesStatusDto[]> {
    const [rows, counts] = await Promise.all([
      this.repository.find(),
      this.planCounts(),
    ]);

    const bySlug = new Map(rows.map((row) => [row.provider, row]));
    const providers = new Set<string>([
      ...OVERVIEW_PROVIDERS,
      ...counts.keys(),
      ...bySlug.keys(),
    ]);

    return Array.from(providers)
      .sort((a, b) => a.localeCompare(b))
      .map((provider) =>
        this.toDto(provider, bySlug.get(provider), counts.get(provider)),
      );
  }

  async setSalesStatus(
    provider: string,
    dto: SetProviderSalesStatusDto,
  ): Promise<ProviderSalesStatusDto> {
    const slug = this.normalizeProvider(provider);

    const affected = dto.isEnabled
      ? await this.plansService.reactivatePlansDisabledByProvider(slug)
      : await this.plansService.deactivatePlansForProvider(slug);

    await this.repository.save(
      this.repository.create({
        provider: slug,
        isEnabled: dto.isEnabled,
        disabledReason: dto.isEnabled
          ? null
          : dto.disabledReason?.trim() || null,
        disabledAt: dto.isEnabled ? null : new Date(),
      }),
    );

    this.logger.log(
      `Provider ${slug} ${dto.isEnabled ? 'enabled' : 'disabled'}: ${affected} plan(s) updated`,
    );

    // The cheapest-plan flags are computed over active plans only, so they are
    // wrong the moment a supplier's plans come off or back on sale.
    await this.plansService.markCheapestPlans();

    const row = (await this.list()).find((item) => item.provider === slug);
    return row ?? this.toDto(slug);
  }

  private toDto(
    provider: string,
    row?: ProviderSalesStatusEntity,
    counts?: PlanCounts,
  ): ProviderSalesStatusDto {
    return {
      provider,
      isEnabled: row?.isEnabled ?? true,
      disabledReason: row?.disabledReason ?? null,
      disabledAt: row?.disabledAt
        ? new Date(row.disabledAt).toISOString()
        : null,
      activePlanCount: counts?.active ?? 0,
      disabledPlanCount: counts?.disabledByProvider ?? 0,
    };
  }
}
