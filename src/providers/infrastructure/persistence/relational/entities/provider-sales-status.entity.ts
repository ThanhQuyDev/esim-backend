import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * Whether a supplier is currently being sold (#005).
 *
 * A missing row means "selling": suppliers are on by default, so a new
 * integration never needs a row created before it can sell.
 */
@Entity({ name: 'provider_sales_status' })
export class ProviderSalesStatusEntity extends EntityRelationalHelper {
  /** Supplier slug, same value as `plan.provider` (e.g. `billion`). */
  @PrimaryColumn({ type: String, length: 64 })
  provider: string;

  @Column({ type: Boolean, default: true })
  isEnabled: boolean;

  /** Why it was switched off, shown back to whoever switches it on again. */
  @Column({ type: String, length: 500, nullable: true })
  disabledReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  disabledAt: Date | null;

  /** "Billion Connect": what the CMS calls it (vande-1411 #024). */
  @Column({ type: String, length: 120, nullable: true })
  displayName: string | null;

  /** "BL": the masked code the overview shows instead of the name. */
  @Column({ type: String, length: 16, nullable: true })
  shortCode: string | null;

  /**
   * Added by hand in "Danh sách Nhà cung cấp": a domestic supplier whose eSIMs
   * come in by file, with no API. Only these can be deleted there.
   */
  @Column({ type: Boolean, default: false })
  isManual: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
