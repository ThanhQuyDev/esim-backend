import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

/**
 * The partner a signed-in customer is attributed to (#034).
 *
 * Keyed by the account rather than a cookie, so the attribution survives a
 * change of device. One row per customer: the most recent link they opened
 * while signed in replaces the previous one (#038).
 */
@Entity({ name: 'partner_member_attribution' })
export class PartnerMemberAttributionEntity extends EntityRelationalHelper {
  @PrimaryColumn({ type: Number })
  userId: number;

  @Index()
  @Column({ type: Number })
  partnerId: number;

  @Column({ type: Number, nullable: true })
  linkId: number | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  attributedAt: Date;
}
