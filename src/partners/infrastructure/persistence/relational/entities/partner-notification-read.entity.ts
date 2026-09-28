import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * One partner having opened one announcement (#079).
 *
 * Kept apart from the announcement itself because most partners never open
 * most announcements: a row here only exists once somebody actually read one,
 * so the table stays small however many are sent.
 */
@Index(['notificationId', 'partnerId'], { unique: true })
@Entity({ name: 'partner_notification_read' })
export class PartnerNotificationReadEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: Number })
  notificationId!: number;

  @Index()
  @Column({ type: Number })
  partnerId!: number;

  @CreateDateColumn()
  readAt!: Date;
}
