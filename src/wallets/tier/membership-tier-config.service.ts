import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipTierConfigEntity } from '../infrastructure/persistence/relational/entities/membership-tier-config.entity';
import { MembershipTierDto } from './membership-tier.dto';
import { TIER_ORDER } from './tier.constants';
import { MembershipTierEnum } from './tier.enum';
import {
  applyTierBenefits,
  currentTierBenefits,
  TierBenefitsTable,
  validateTierLadder,
} from './tier.registry';
import { UpdateMembershipTierDto } from './update-membership-tier.dto';

/** Another API instance may have saved a change; pick it up within a minute. */
const RELOAD_INTERVAL_MS = 60_000;

/**
 * Keeps the in-memory tier table in step with `membership_tier_config` (#024).
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
   * Load the saved ladder. A missing table, missing rows or a broken ladder keep
   * the table already in use — paying the last good values beats paying nothing.
   */
  async reload(): Promise<void> {
    try {
      const rows = await this.repository.find();
      if (rows.length === 0) return;

      const table = this.copyCurrent();
      for (const row of rows) {
        if (!TIER_ORDER.includes(row.tier)) continue;
        table[row.tier] = {
          minimumSpendVnd: Number(row.minimumSpendVnd),
          cashbackPercent: Number(row.cashbackPercent),
          referralRewardVnd: Number(row.referralRewardVnd),
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
    return TIER_ORDER.map((tier) => ({ tier, ...table[tier] }));
  }

  async update(
    tier: MembershipTierEnum,
    dto: UpdateMembershipTierDto,
  ): Promise<MembershipTierDto[]> {
    // Validate against what is saved now, not a copy that may be a minute old.
    await this.reload();

    const table = this.copyCurrent();
    table[tier] = {
      minimumSpendVnd: dto.minimumSpendVnd ?? table[tier].minimumSpendVnd,
      cashbackPercent: dto.cashbackPercent ?? table[tier].cashbackPercent,
      referralRewardVnd: dto.referralRewardVnd ?? table[tier].referralRewardVnd,
    };

    const problem = validateTierLadder(table);
    if (problem) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { [problem.field]: problem.code },
      });
    }

    // Save the whole ladder so the table is complete even if rows went missing.
    await this.repository.save(
      TIER_ORDER.map((rowTier) =>
        this.repository.create({ tier: rowTier, ...table[rowTier] }),
      ),
    );
    applyTierBenefits(table);
    this.logger.log(
      `Membership tier ${tier} updated: ${JSON.stringify(table[tier])}`,
    );

    return this.list();
  }

  private copyCurrent(): TierBenefitsTable {
    const table = currentTierBenefits();
    return TIER_ORDER.reduce((copy, tier) => {
      copy[tier] = { ...table[tier] };
      return copy;
    }, {} as TierBenefitsTable);
  }
}
