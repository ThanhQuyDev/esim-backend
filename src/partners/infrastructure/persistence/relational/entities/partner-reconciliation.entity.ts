import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * What an admin decided about one partner's month (#065).
 *
 * Only the decision is stored. The figures — valid orders, eSIMs sold, share
 * through a code, revenue, commission — are worked out from the commissions
 * each time, because they change when an order is refunded and a stored copy
 * would quietly stop matching.
 *
 * A partner-period with no row here reads as "chờ xác nhận".
 */
@Index(['partnerId', 'period'], { unique: true })
@Entity({ name: 'partner_reconciliation' })
export class PartnerReconciliationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: Number })
  partnerId!: number;

  /** The reconciliation period, as `YYYY-MM`. */
  @Column({ type: String, length: 7 })
  period!: string;

  /** `pending` | `reviewing` | `approved`. */
  @Column({ type: String, length: 20, default: 'pending' })
  status!: string;

  /** An admin's note on this statement, at most 1000 characters (#065). */
  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: Number, nullable: true })
  updatedByAdminId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
