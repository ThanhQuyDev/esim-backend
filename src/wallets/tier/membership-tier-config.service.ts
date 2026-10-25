import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipTierConfigEntity } from '../infrastructure/persistence/relational/entities/membership-tier-config.entity';
import { MembershipTierDto } from './membership-tier.dto';
import { MembershipTierCode } from './tier.enum';
import {
  applyTierBenefits,
  baseTier,
  currentTierBenefits,
  TierBenefitsTable,
  tierOrder,
  validateTierLadder,
} from './tier.registry';
import {
  CreateMembershipTierDto,
  UpdateMembershipTierDto,
} from './update-membership-tier.dto';

/** Another API instance may have saved a change; pick it up within a minute. */
const RELOAD_INTERVAL_MS = 60_000;

/** "Kim cương" → "kim-cuong": a code that is safe in URLs and filters. */
export function tierCodeFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/**
 * Keeps the in-memory tier table in step with `membership_tier_config` (#024),
 * and lets an admin rename, add and remove tiers (vande #066).
 */
@Injectable()
export class MembershipTierConfigService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MembershipTierConfigService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(MembershipTierConfigEntity)
    private readonly repository: Repository<MembershipTierConfigEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
    this.timer = setInterval(() => void this.reload(), RELOAD_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Load the saved ladder — every row, the four built-in tiers and any an
   * admin added. A missing table, no rows or a broken ladder keep the table
   * already in use: paying the last good values beats paying nothing.
   */
  async reload(): Promise<void> {
    try {
      const rows = await this.repository.find();
      if (rows.length === 0) return;

      const table: TierBenefitsTable = {};
      for (const row of rows) {
        table[row.tier] = {
          minimumSpendVnd: Number(row.minimumSpendVnd),
          cashbackPercent: Number(row.cashbackPercent),
          referralRewardVnd: Number(row.referralRewardVnd),
          name: row.name?.trim() || row.tier,
          nameEn: row.nameEn?.trim() || null,
        };
      }

      const problem = validateTierLadder(table);
      if (problem) {
        this.logger.error(
          `Ignoring saved membership tiers: ${problem.tier}.${problem.field} ${problem.code}`,
        );
        return;
      }
      applyTierBenefits(table);
    } catch (error) {
      this.logger.error(
        `Could not load membership tiers: ${(error as Error).message}`,
      );
    }
  }

  list(): MembershipTierDto[] {
    const table = currentTierBenefits();
    return tierOrder(table).map((tier) => ({ tier, ...table[tier] }));
  }

  async update(
    tier: MembershipTierCode,
    dto: UpdateMembershipTierDto,
  ): Promise<MembershipTierDto[]> {
    // Validate against what is saved now, not a copy that may be a minute old.
    await this.reload();

    const table = this.copyCurrent();
    const row = table[tier];
    if (!row) throw new NotFoundException(`Không có hạng "${tier}".`);
    table[tier] = {
      minimumSpendVnd: dto.minimumSpendVnd ?? row.minimumSpendVnd,
      cashbackPercent: dto.cashbackPercent ?? row.cashbackPercent,
      referralRewardVnd: dto.referralRewardVnd ?? row.referralRewardVnd,
      name: dto.name !== undefined ? dto.name.trim() : row.name,
      nameEn:
        dto.nameEn !== undefined ? dto.nameEn?.trim() || null : row.nameEn,
    };

    await this.saveLadder(table);
    this.logger.log(
      `Membership tier ${tier} updated: ${JSON.stringify(table[tier])}`,
    );
    return this.list();
  }

  /** A new tier, placed on the ladder by what it requires (vande #066). */
  async create(dto: CreateMembershipTierDto): Promise<MembershipTierDto[]> {
    await this.reload();
    const table = this.copyCurrent();
    const code = tierCodeFromName(dto.code?.trim() || dto.name);
    if (!code) {
      throw new BadRequestException('Tên hạng cần có chữ hoặc số.');
    }
    if (table[code]) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { name: 'tierAlreadyExists' },
      });
    }
    table[code] = {
      minimumSpendVnd: dto.minimumSpendVnd,
      cashbackPercent: dto.cashbackPercent,
      referralRewardVnd: dto.referralRewardVnd,
      name: dto.name.trim(),
      nameEn: dto.nameEn?.trim() || null,
    };

    await this.saveLadder(table);
    this.logger.log(
      `Membership tier ${code} added: ${JSON.stringify(table[code])}`,
    );
    return this.list();
  }

  /**
   * Remove a tier nobody is placed on by hand (vande #066). Customers it held
   * automatically fall to the tier below by their spend; orders keep the code
   * they were placed under. The first tier — everybody's starting point —
   * cannot go.
   */
  async remove(tier: MembershipTierCode): Promise<MembershipTierDto[]> {
    await this.reload();
    const table = this.copyCurrent();
    if (!table[tier]) throw new NotFoundException(`Không có hạng "${tier}".`);
    if (tier === baseTier(table)) {
      throw new BadRequestException(
        'Không xoá được hạng đầu tiên — mọi khách hàng mới bắt đầu từ hạng này.',
      );
    }
    const [{ count }] = (await this.repository.query(
      `SELECT COUNT(*)::int AS count FROM "user"
        WHERE "tierOverride" = $1 AND "deletedAt" IS NULL`,
      [tier],
    )) as { count: number }[];
    if (count > 0) {
      throw new BadRequestException(
        `Còn ${count} khách hàng được gán tay hạng này. Đổi hạng của họ trước khi xoá.`,
      );
    }

    delete table[tier];
    const problem = validateTierLadder(table);
    if (problem) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { [problem.field]: problem.code },
      });
    }
    await this.repository.delete({ tier });
    applyTierBenefits(table);
    this.logger.log(`Membership tier ${tier} removed`);
    return this.list();
  }

  /** Validate, then save the whole ladder so it is complete in the database. */
  private async saveLadder(table: TierBenefitsTable): Promise<void> {
    const problem = validateTierLadder(table);
    if (problem) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { [problem.field]: problem.code },
      });
    }
    await this.repository.save(
      tierOrder(table).map((tier) =>
        this.repository.create({ tier, ...table[tier] }),
      ),
    );
    applyTierBenefits(table);
  }

  private copyCurrent(): TierBenefitsTable {
    const table = currentTierBenefits();
    return Object.fromEntries(
      Object.entries(table).map(([tier, row]) => [tier, { ...row }]),
    );
  }
}
