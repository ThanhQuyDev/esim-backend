import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { SessionEventTypeEnum } from '../../../../partners.enum';

/**
 * One step of a buying session (#040).
 *
 * Read back as "this session's steps, oldest first" when an order is created,
 * to tell a real visit from one a script drove — see
 * `PartnersService.evaluateSessionShape`.
 */
@Index(['visitorId', 'occurredAt'])
@Index(['clickId', 'occurredAt'])
@Entity({ name: 'partner_session_event' })
export class PartnerSessionEventEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  /** The browser's own id, from the `esim_visitor_id` cookie. */
  @Column({ type: String, length: 64, nullable: true })
  visitorId?: string | null;

  /** The click this session started from, when it started from one (#039). */
  @Column({ type: String, length: 64, nullable: true })
  clickId?: string | null;

  @Column({ type: String, length: 32 })
  eventType!: SessionEventTypeEnum;

  /** What was looked at — a plan slug for a plan view, otherwise nothing. */
  @Column({ type: String, length: 160, nullable: true })
  ref?: string | null;

  @Column({ type: String, length: 64, nullable: true })
  ipHash?: string | null;

  @CreateDateColumn()
  occurredAt!: Date;
}
