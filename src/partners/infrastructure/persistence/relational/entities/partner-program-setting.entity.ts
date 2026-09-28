import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * The partner programme's settings, as one row (#075, #076, #077).
 *
 * These were constants in the source, which made changing a minimum
 * withdrawal a deploy. They are also not one number each: what a marketing
 * partner may withdraw and what a distribution partner must keep on deposit
 * are separate decisions.
 */
@Entity({ name: 'partner_program_setting' })
export class PartnerProgramSettingEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Smallest withdrawal a marketing partner may request (#075). */
  @Column({ type: 'int', default: 50_000 })
  payoutMinKolVnd!: number;

  /** Smallest withdrawal a distribution partner may request (#075). */
  @Column({ type: 'int', default: 50_000 })
  payoutMinDistributionVnd!: number;

  /** Smallest top-up a marketing partner may make (#075). */
  @Column({ type: 'int', default: 100_000 })
  depositMinKolVnd!: number;

  /** Smallest top-up a distribution partner may make (#075). */
  @Column({ type: 'int', default: 100_000 })
  depositMinDistributionVnd!: number;

  /**
   * Below this, a distribution partner is warned to top up (#077).
   *
   * A warning, not a block: running out mid-order is what we are trying to
   * avoid, and stopping them early would cause exactly that.
   */
  @Column({ type: 'int', default: 500_000 })
  lowDepositWarningVnd!: number;

  /** Whether the monthly statement email goes out at all (#076). */
  @Column({ type: Boolean, default: false })
  reconciliationEmailEnabled!: boolean;

  /**
   * Day of the month the statement for the previous month is sent (#076).
   *
   * 5 means "ngày 5 của tháng N+1 gửi đối soát tháng N". Capped at 28 so it
   * fires in February too.
   */
  @Column({ type: 'int', default: 5 })
  reconciliationEmailDayOfMonth!: number;

  @Column({ type: Number, nullable: true })
  updatedByAdminId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
