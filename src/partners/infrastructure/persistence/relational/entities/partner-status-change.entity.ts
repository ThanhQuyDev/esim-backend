import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * Why a partner's status changed (#059, #060).
 *
 * Locking an account is a decision somebody answers for later, so the reason is
 * kept beside the change rather than only the new value. Written once and never
 * edited: a history, not a current-state column.
 */
@Index(['partnerId', 'createdAt'])
@Entity({ name: 'partner_status_change' })
export class PartnerStatusChangeEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: Number })
  partnerId!: number;

  @Column({ type: String, length: 20, nullable: true })
  fromStatus!: string | null;

  @Column({ type: String, length: 20 })
  toStatus!: string;

  /** Required for a lock or a hold; an admin has to say why (#060). */
  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: Number, nullable: true })
  changedByAdminId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
