import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OVERVIEW_PROVIDERS } from '../overview/dto/overview.dto';
import { PlansService } from '../plans/plans.service';
import {
  CreateProviderDto,
  ProviderSalesStatusDto,
  SetProviderSalesStatusDto,
  UpdateProviderDto,
} from './dto/provider-sales-status.dto';
import { domesticProviderOf } from '../plans/domestic-provider';
import { ProviderSalesStatusEntity } from './infrastructure/persistence/relational/entities/provider-sales-status.entity';

const PROVIDER_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

interface PlanCounts {
  active: number;
  disabledByProvider: number;
  total?: number;
  esims?: number;
}

/**
 * Suppliers this backend sells through an API (vande-1411 #024). They are
 * code, not data: the CMS can rename them but never delete them.
 */
export const API_PROVIDERS = [
  'airalo',
  'esimaccess',
  'gadgetkorea',
  'microesim',
  'billion',
] as const;

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
              COUNT(*) FILTER (WHERE "disabledByProvider" = true) AS "disabled",
              COUNT(*) AS "total"
       FROM "plan"
       WHERE "deletedAt" IS NULL
       GROUP BY "provider"`,
    )) as {
      provider: string;
      active: string | number;
      disabled: string | number;
      total?: string | number;
    }[];

    const counts = new Map<string, PlanCounts>(
      rows
        .filter((row) => !!row.provider)
        .map((row) => [
          row.provider.toLowerCase(),
          {
            active: Number(row.active) || 0,
            disabledByProvider: Number(row.disabled) || 0,
            total: Number(row.total) || 0,
          },
        ]),
    );
    // eSIMs, in stock or sold, so a supplier with history is not deleted.
    const esims = (await this.repository.manager.query(
      `SELECT LOWER("provider") AS "provider", COUNT(*) AS "esims"
       FROM "esim"
       WHERE "provider" IS NOT NULL
       GROUP BY LOWER("provider")`,
    )) as { provider: string; esims?: string | number }[];
    for (const row of esims ?? []) {
      if (!row?.provider) continue;
      const slug = row.provider.toLowerCase();
      const entry = counts.get(slug) ?? { active: 0, disabledByProvider: 0 };
      entry.esims = Number(row.esims) || 0;
      counts.set(slug, entry);
    }
    return counts;
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

  /**
   * "+ Thêm nhà cung cấp" (vande-1411 #024): a domestic supplier whose eSIMs
   * are imported by file. Its system name is "<carrier>-noidia", the provider
   * a domestic import file gives its plans, so the file finds it.
   */
  async create(dto: CreateProviderDto): Promise<ProviderSalesStatusDto> {
    const slug = this.normalizeProvider(domesticProviderOf(dto.provider));
    const known = (await this.list()).some((item) => item.provider === slug);
    if (known) {
      throw new ConflictException(`Nhà cung cấp "${slug}" đã có`);
    }
    await this.repository.save(
      this.repository.create({
        provider: slug,
        isEnabled: true,
        disabledReason: null,
        disabledAt: null,
        displayName: dto.displayName.trim(),
        shortCode: dto.shortCode.trim().toUpperCase(),
        isManual: true,
      }),
    );
    const row = (await this.list()).find((item) => item.provider === slug);
    return row ?? this.toDto(slug);
  }

  /** "Cập nhật": the name and the overview code; any supplier. */
  async update(
    provider: string,
    dto: UpdateProviderDto,
  ): Promise<ProviderSalesStatusDto> {
    const slug = this.normalizeProvider(provider);
    const item = (await this.list()).find((row) => row.provider === slug);
    if (!item) throw new NotFoundException(`Không có nhà cung cấp "${slug}"`);
    await this.repository.save(
      this.repository.create({
        provider: slug,
        ...(dto.displayName !== undefined && {
          displayName: dto.displayName.trim(),
        }),
        ...(dto.shortCode !== undefined && {
          shortCode: dto.shortCode.trim().toUpperCase(),
        }),
      }),
    );
    const row = (await this.list()).find((r) => r.provider === slug);
    return row ?? this.toDto(slug);
  }

  /**
   * "Xoá": only a supplier added by hand, and only while nothing hangs off it —
   * no plan and no eSIM, sold or in stock. Anything else stays, so no order,
   * eSIM or report loses its supplier.
   */
  async remove(provider: string): Promise<void> {
    const slug = this.normalizeProvider(provider);
    const item = (await this.list()).find((row) => row.provider === slug);
    if (!item) throw new NotFoundException(`Không có nhà cung cấp "${slug}"`);
    if (item.isApi || !item.isManual) {
      throw new ConflictException(
        'Chỉ xoá được nhà cung cấp thêm tay; nhà cung cấp có sẵn trong hệ thống chỉ tắt bán được.',
      );
    }
    if (item.planCount > 0 || item.esimCount > 0) {
      throw new ConflictException(
        `Không xoá được: nhà cung cấp còn ${item.planCount} gói và ${item.esimCount} eSIM. Hãy tắt bán thay vì xoá.`,
      );
    }
    await this.repository.delete({ provider: slug });
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
      displayName: row?.displayName ?? null,
      shortCode: row?.shortCode ?? null,
      isApi: (API_PROVIDERS as readonly string[]).includes(provider),
      isManual: !!row?.isManual,
      planCount: counts?.total ?? 0,
      esimCount: counts?.esims ?? 0,
    };
  }
}
