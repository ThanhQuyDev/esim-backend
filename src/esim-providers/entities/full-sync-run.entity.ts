import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../utils/relational-entity-helper';

/**
 * One run of "Cập nhật lại toàn bộ sản phẩm" — the 6-hourly catalogue sync or
 * an admin's manual run — kept so the suppliers page can list the latest ones
 * with how long each took (vande #078).
 */
@Entity({ name: 'full_sync_run' })
export class FullSyncRunEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String, length: 10 })
  trigger: 'cron' | 'manual';

  /** The admin who started a manual run; null for the scheduled one. */
  @Column({ type: Number, nullable: true })
  adminId: number | null;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  /** Suppliers whose call failed, one "Name: reason" per entry. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors: string[];
}
