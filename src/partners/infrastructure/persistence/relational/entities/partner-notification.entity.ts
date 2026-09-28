import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * An announcement an admin sent to partners (#079).
 *
 * One row per announcement, not per recipient: a message to four hundred
 * partners is one thing that was said, and copying it would make fixing a typo
 * four hundred writes.
 */
@Entity({ name: 'partner_notification' })
export class PartnerNotificationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: String, length: 200 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  /** `all` | `kol` | `distribution` — the group this was sent to. */
  @Column({ type: String, length: 20, default: 'all' })
  audience!: string;

  /** Whether it also went out by email, not only to the bell. */
  @Column({ type: Boolean, default: false })
  sendEmail!: boolean;

  /**
   * How many emails actually went out.
   *
   * Recorded rather than inferred from the audience, because a partner with no
   * address on file gets the bell and no email, and the sent list should not
   * claim otherwise.
   */
  @Column({ type: 'int', default: 0 })
  emailsSent!: number;

  @Column({ type: Number, nullable: true })
  createdByAdminId!: number | null;

  @Index()
  @CreateDateColumn()
  createdAt!: Date;
}
