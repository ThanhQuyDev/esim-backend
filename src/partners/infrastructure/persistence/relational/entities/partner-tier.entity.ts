import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PartnerTypeEnum } from '../../../../partners.enum';

@Entity({ name: 'partner_tier' })
@Index(['partnerType', 'tierCode'], { unique: true })
export class PartnerTierEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: String })
  partnerType!: PartnerTypeEnum;

  @Column({ type: String })
  tierCode!: string;

  @Column({ type: String })
  tierName!: string;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  minVolumeVnd!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionPercent!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  maxDiscountPercent!: number;

  /**
   * The deposit that also earns this tier (#073).
   *
   * An alternative to `minVolumeVnd`, not a second condition: a distribution
   * partner holding 100 triệu on account is as committed as one who has turned
   * over 500 triệu, so either alone qualifies. Zero means revenue only.
   */
  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  minDepositVnd!: number;

  /**
   * What this tier buys a distribution partner: the % added to cost (#073).
   *
   * 10 means a 100.000đ eSIM costs them 110.000đ. The higher the tier the
   * smaller this gets — closer to what the eSIM actually cost us.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  costMarkupPercent!: number;

  /**
   * A tier that is negotiated rather than earned (#074).
   *
   * Left out of the public ladder and of the weekly review; a partner only
   * ends up on one because an admin put them there, and the review leaves
   * them on it.
   */
  @Index()
  @Column({ type: Boolean, default: false })
  isInternal!: boolean;

  /**
   * Days a click by this tier's partner keeps earning them the order (#037).
   * Every fresh click restarts the clock.
   */
  @Column({ type: 'int', default: 30 })
  attributionDays!: number;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Index()
  @Column({ type: Boolean, default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;
}
