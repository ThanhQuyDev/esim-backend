import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * One thing that happened to a marketing link, and who did it
 * (doitac-1410 #018): the "Lịch sử thay đổi" of the link's detail popup.
 * Written once, never edited.
 */
@Entity({ name: 'partner_link_event' })
export class PartnerLinkEventEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: Number })
  linkId!: number;

  @Column({ type: Number })
  partnerId!: number;

  /**
   * created | renamed | retargeted | paused | resumed | deleted | restored |
   * suspended | unsuspended | appealed | account_suspended | account_restored
   */
  @Column({ type: String, length: 40 })
  action!: string;

  /** partner | admin | system */
  @Column({ type: String, length: 10 })
  actorRole!: string;

  @Column({ type: Number, nullable: true })
  actorId?: number | null;

  @Column({ type: 'jsonb', nullable: true })
  detail?: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
