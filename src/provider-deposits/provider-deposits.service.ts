import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OrderItemEntity } from '../order-items/infrastructure/persistence/relational/entities/order-item.entity';
import {
  COMPLETED_ORDER_ITEM_STATUSES,
  COMPLETED_ORDER_STATUSES,
} from '../overview/dto/overview.dto';
import {
  CreateProviderDepositEntryDto,
  ProviderDepositSummaryDto,
  UpdateProviderDepositEntryDto,
} from './dto/provider-deposit.dto';
import {
  ProviderDepositEntryEntity,
  ProviderDepositEntryType,
} from './infrastructure/persistence/relational/entities/provider-deposit-entry.entity';

type RawValue = string | number | null | undefined;

/**
 * Tracks the deposit ("ký quỹ") esim.vn holds with each eSIM supplier.
 *
 * Only the money the admin puts IN is stored. What has been spent is summed
 * live from completed order items, exactly the way the Overview page computes
 * cost — so the two screens can never disagree, and the balance cannot rot if
 * an order is edited later.
 */
@Injectable()
export class ProviderDepositsService {
  constructor(
    @InjectRepository(ProviderDepositEntryEntity)
    private readonly entriesRepository: Repository<ProviderDepositEntryEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemsRepository: Repository<OrderItemEntity>,
  ) {}

  private toNumber(value: RawValue): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async createEntry(
    dto: CreateProviderDepositEntryDto,
  ): Promise<ProviderDepositEntryEntity> {
    const entity = this.entriesRepository.create({
      provider: dto.provider.trim().toLowerCase(),
      type: dto.type ?? ProviderDepositEntryType.Deposit,
      amountVnd: dto.amountVnd ?? 0,
      reportedBalanceVnd: dto.reportedBalanceVnd ?? null,
      note: dto.note ?? null,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
    });

    return this.entriesRepository.save(entity);
  }

  async updateEntry(
    id: number,
    dto: UpdateProviderDepositEntryDto,
  ): Promise<ProviderDepositEntryEntity> {
    const entity = await this.entriesRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Provider deposit entry ${id} not found`);
    }

    if (dto.type !== undefined) entity.type = dto.type;
    if (dto.amountVnd !== undefined) entity.amountVnd = dto.amountVnd;
    if (dto.reportedBalanceVnd !== undefined) {
      entity.reportedBalanceVnd = dto.reportedBalanceVnd;
    }
    if (dto.note !== undefined) entity.note = dto.note;
    if (dto.occurredAt !== undefined) {
      entity.occurredAt = new Date(dto.occurredAt);
    }

    return this.entriesRepository.save(entity);
  }

  async removeEntry(id: number): Promise<void> {
    await this.entriesRepository.softDelete(id);
  }

  async findEntries(options: {
    provider?: string;
    page: number;
    limit: number;
  }): Promise<[ProviderDepositEntryEntity[], number]> {
    return this.entriesRepository.findAndCount({
      where: {
        deletedAt: IsNull(),
        ...(options.provider
          ? { provider: options.provider.trim().toLowerCase() }
          : {}),
      },
      order: { occurredAt: 'DESC', id: 'DESC' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  }

  /** Total deposited (and the latest reported balance) per supplier. */
  private async loadDepositTotals(): Promise<
    Map<
      string,
      {
        totalDepositedVnd: number;
        entryCount: number;
        reportedBalanceVnd: number | null;
        reportedAt: Date | null;
      }
    >
  > {
    const entries = await this.entriesRepository.find({
      where: { deletedAt: IsNull() },
      order: { occurredAt: 'ASC', id: 'ASC' },
    });

    const totals = new Map<
      string,
      {
        totalDepositedVnd: number;
        entryCount: number;
        reportedBalanceVnd: number | null;
        reportedAt: Date | null;
      }
    >();

    for (const entry of entries) {
      const key = entry.provider;
      const current = totals.get(key) ?? {
        totalDepositedVnd: 0,
        entryCount: 0,
        reportedBalanceVnd: null,
        reportedAt: null,
      };

      // A pure reconciliation only reports a balance; it moves no money.
      if (entry.type !== ProviderDepositEntryType.Reconciliation) {
        current.totalDepositedVnd += this.toNumber(entry.amountVnd);
      }
      current.entryCount += 1;

      // Entries are walked oldest-first, so the last one wins — the most
      // recent reported balance is the one worth comparing against.
      if (entry.reportedBalanceVnd !== null) {
        current.reportedBalanceVnd = this.toNumber(entry.reportedBalanceVnd);
        current.reportedAt = entry.occurredAt;
      }

      totals.set(key, current);
    }

    return totals;
  }

  /** Cost of everything actually delivered, per supplier, in VND. */
  private async loadSpendByProvider(): Promise<Map<string, number>> {
    const rows = await this.orderItemsRepository
      .createQueryBuilder('order_item')
      .innerJoin('order_item.order', 'order')
      .innerJoin('order_item.plan', 'plan')
      .where('order.status IN (:...completedOrderStatuses)', {
        completedOrderStatuses: [...COMPLETED_ORDER_STATUSES],
      })
      .andWhere('order_item.status IN (:...completedOrderItemStatuses)', {
        completedOrderItemStatuses: [...COMPLETED_ORDER_ITEM_STATUSES],
      })
      .select('plan.provider', 'provider')
      .addSelect('COALESCE(SUM(order_item."vndCostPrice"), 0)', 'spent')
      .groupBy('plan.provider')
      .getRawMany<{ provider: string; spent: RawValue }>();

    return new Map(
      rows
        .filter((row) => !!row.provider)
        .map((row) => [row.provider.toLowerCase(), this.toNumber(row.spent)]),
    );
  }

  /**
   * One row per supplier that has either a deposit entry or any spend, so a
   * supplier shows up as soon as it is worth watching.
   */
  async getSummary(): Promise<ProviderDepositSummaryDto[]> {
    const [deposits, spend] = await Promise.all([
      this.loadDepositTotals(),
      this.loadSpendByProvider(),
    ]);

    const providers = new Set<string>([...deposits.keys(), ...spend.keys()]);

    return Array.from(providers)
      .map((provider) => {
        const deposit = deposits.get(provider);
        const totalDepositedVnd = deposit?.totalDepositedVnd ?? 0;
        const totalSpentVnd = spend.get(provider) ?? 0;
        const expectedBalanceVnd = totalDepositedVnd - totalSpentVnd;
        const reportedBalanceVnd = deposit?.reportedBalanceVnd ?? null;

        return {
          provider,
          totalDepositedVnd,
          totalSpentVnd,
          expectedBalanceVnd,
          reportedBalanceVnd,
          reportedAt: deposit?.reportedAt?.toISOString() ?? null,
          differenceVnd:
            reportedBalanceVnd === null
              ? null
              : reportedBalanceVnd - expectedBalanceVnd,
          entryCount: deposit?.entryCount ?? 0,
        };
      })
      .sort((a, b) => a.provider.localeCompare(b.provider));
  }
}
