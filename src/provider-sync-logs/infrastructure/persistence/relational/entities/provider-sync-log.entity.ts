import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({ name: 'provider_sync_log' })
export class ProviderSyncLogEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: String })
  provider: string;

  @Index()
  @Column({ type: String })
  syncType: string;

  @Index()
  @Column({ type: String, default: 'started' })
  status: string;

  @Column({ type: 'int', nullable: true })
  itemsSynced: number | null;

  @Column({ type: String, nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
