import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * Tax / fee added to a supplier's cost before prices are compared (#049).
 *
 * Some suppliers bill with tax or fees on top of the listed cost, so comparing
 * raw `costPrice` made them look cheaper than they are. `markCheapestPlans`
 * compares `costPrice × (1 + percentage / 100)` instead.
 */
@Entity({ name: 'provider_surcharge' })
export class ProviderSurchargeEntity extends EntityRelationalHelper {
  /** Supplier slug, same value as `plan.provider` (e.g. `billion`). */
  @PrimaryColumn({ type: String, length: 64 })
  provider: string;

  /** Percent added to the cost; 0 = compared at its listed cost. */
  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  percentage: number;

  @Column({ type: String, length: 500, nullable: true })
  note: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
