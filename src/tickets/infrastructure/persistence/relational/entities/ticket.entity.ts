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

  /**
   * Opened by a partner — the email belongs to a partner account (#042, test
   * round 4). Their messages read "Đối tác" in the CMS, and a closed ticket
   * points them back to the portal rather than the public form.
   */
  @Column({ type: Boolean, default: false })
  fromPartner: boolean;

  /** Latest message and its author (#041, test round 4). */
  @Column({ type: 'timestamp', nullable: true })
  lastReplyAt: Date | null;

  @Column({ type: String, nullable: true })
  lastReplyRole: string | null;

  @Column({ type: String, nullable: true })
  lastReplyName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
