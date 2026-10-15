import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PartnerEntity } from './partner.entity';
import { PartnerLinkStatusEnum } from '../../../../partners.enum';

@Entity({ name: 'partner_link' })
export class PartnerLinkEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  partnerId!: number;

  @ManyToOne(() => PartnerEntity)
  @JoinColumn({ name: 'partnerId' })
  partner?: PartnerEntity;

  @Index({ unique: true })
  @Column({ type: String })
  code!: string;

  @Column({ type: String })
  label!: string;

  @Column({ type: String, nullable: true })
  targetPath?: string | null;

  @Index()
  @Column({ type: String, default: PartnerLinkStatusEnum.ACTIVE })
  status!: PartnerLinkStatusEnum;

  /** The partner's own on/off, restored when the suspension lifts (#004). */
  @Column({ type: String, nullable: true })
  statusBeforeSuspend?: PartnerLinkStatusEnum | null;

  /** When a customer last clicked it, for "Lần nhấp gần nhất" (doitac-1410 #018). */
  @Column({ type: 'timestamptz', nullable: true })
  lastClickedAt?: Date | null;

  /**
   * Suspended by an admin, this link alone (doitac-1410 #018) — not by the
   * account lock, which suspends every link and gives them back on unlock.
   */
  @Column({ type: Boolean, default: false })
  suspendedByAdmin!: boolean;

  @Column({ type: String, length: 500, nullable: true })
  suspendedReason?: string | null;

  /** When the partner appealed the suspension, and the ticket it opened. */
  @Column({ type: 'timestamptz', nullable: true })
  appealedAt?: Date | null;

  @Column({ type: Number, nullable: true })
  appealTicketId?: number | null;

  /**
   * The partner asked esim.vn to restore this deleted link, and why
   * (doitac-1410 #019). Cleared when an admin decides.
   */
  @Column({ type: 'timestamptz', nullable: true })
  restoreRequestedAt?: Date | null;

  @Column({ type: String, length: 1000, nullable: true })
  restoreRequestReason?: string | null;

  @Column({ type: 'int', default: 0 })
  clickCount!: number;

  @Column({ type: 'int', default: 0 })
  conversionCount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  totalCommissionVnd!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;
}
