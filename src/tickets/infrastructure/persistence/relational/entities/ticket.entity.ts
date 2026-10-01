import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({ name: 'ticket' })
export class TicketEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * The reference the customer sees — `HT-000123` (#059). Nullable only so the
   * row can be inserted before its id exists; it is filled in immediately after.
   */
  @Index({ unique: true })
  @Column({ type: String, nullable: true })
  ticketNumber: string | null;

  @Column({ type: String })
  customerEmail: string;

  @Column({ type: String })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: String, nullable: true })
  orderId: string | null;

  @Column({ type: String, nullable: true })
  deviceModel: string | null;

  @Column({ type: String, nullable: true })
  iccid: string | null;

  @Column({ type: String, nullable: true })
  planDestination: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[] | null;

  @Column({ type: String, default: 'open' })
  status: string;

  /**
   * When the ticket was marked resolved (#061) — the clock the 48-hour auto-close
   * runs off. Deliberately not `updatedAt`, which any later edit would move.
   */
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
