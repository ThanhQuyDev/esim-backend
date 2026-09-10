import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/** What an entry records. */
export enum ProviderDepositEntryType {
  /** Money paid into the supplier's deposit account. */
  Deposit = 'deposit',
  /** A manual correction (fee, refund from supplier, fixing a typo…). */
  Adjustment = 'adjustment',
  /** Only records what the supplier's own dashboard showed at that moment. */
  Reconciliation = 'reconciliation',
}

@Entity({ name: 'provider_deposit_entry' })
export class ProviderDepositEntryEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  /** Supplier slug, same value as `plan.provider` (e.g. `esimaccess`). */
  @Index()
  @Column({ type: String, length: 64 })
  provider: string;

  @Column({
    type: String,
    length: 32,
    default: ProviderDepositEntryType.Deposit,
  })
  type: ProviderDepositEntryType;

  /**
   * Movement in VND. Positive adds to the deposit, negative takes away — an
   * `adjustment` is the only kind that is normally negative.
   */
  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  amountVnd: number;

  /**
   * The balance the supplier itself reported at `occurredAt`, when the admin
   * bothered to check. This is what makes drift visible: comparing it with the
   * balance computed from deposits minus spend.
   */
  @Column({ type: 'decimal', precision: 14, scale: 0, nullable: true })
  reportedBalanceVnd: number | null;

  @Column({ type: String, length: 500, nullable: true })
  note: string | null;

  /** When the movement happened — set by the admin, not by the DB clock. */
  @Index()
  @Column({ type: 'timestamp', default: () => 'now()' })
  occurredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
