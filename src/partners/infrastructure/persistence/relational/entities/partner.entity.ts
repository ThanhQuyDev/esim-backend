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
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import {
  PartnerLegalTypeEnum,
  PartnerStatusEnum,
  PartnerTypeEnum,
} from '../../../../partners.enum';

/** Bank details a partner asked to change, held until the code confirms (#005). */
export interface PendingBankChange {
  values: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
    bankBranch: string | null;
  };
  otpHash: string;
  expiresAt: string;
  attempts: number;
  requestedAt: string;
}

@Entity({ name: 'partner' })
export class PartnerEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number, unique: true })
  userId!: number;

  @ManyToOne(() => UserEntity, { eager: true })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Index()
  @Column({ type: String })
  partnerType!: PartnerTypeEnum;

  @Column({ type: String })
  legalType!: PartnerLegalTypeEnum;

  @Column({ type: String, nullable: true })
  companyName?: string | null;

  @Column({ type: String, nullable: true })
  taxCode?: string | null;

  @Column({ type: String, nullable: true })
  businessAddress?: string | null;

  @Column({ type: String })
  contactName!: string;

  @Column({ type: String })
  contactPhone!: string;

  @Column({ type: String })
  contactEmail!: string;

  @Column({ type: 'jsonb', nullable: true })
  channelInfo?: Record<string, unknown> | null;

  @Index()
  @Column({ type: String, default: PartnerStatusEnum.PENDING })
  status!: PartnerStatusEnum;

  @Index()
  @Column({ type: String, nullable: true })
  tierCode?: string | null;

  @Column({ type: Number, nullable: true })
  assignedManagerId?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt?: Date | null;

  @Column({ type: Number, nullable: true })
  approvedByAdminId?: number | null;

  @Column({ type: String, nullable: true })
  rejectionReason?: string | null;

  /**
   * Admin ticked this partner as allowed to name their own link code (#014);
   * everyone else gets a generated one.
   */
  @Column({ type: Boolean, default: false })
  canCustomLinkCode!: boolean;

  @Column({ type: String, nullable: true })
  notes?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * When the current tier took effect (#042).
   *
   * A tier change is never retroactive: orders placed after this moment earn at
   * the new rate, everything before it keeps what it was worked out at. Recorded
   * so a partner asking about a period can be shown the date rather than told.
   */
  @Column({ type: 'timestamp', nullable: true })
  tierEffectiveFrom?: Date | null;

  /**
   * Branding for this partner's own portal page.
   * Shape: `{ displayName?, logoUrl?, tagline? }`.
   */
  @Column({ type: 'jsonb', nullable: true })
  brandInfo?: Record<string, unknown> | null;

  /** Default payout account. Each payout still snapshots what it was sent to. */
  @Column({ type: String, nullable: true })
  bankName?: string | null;

  @Column({ type: String, nullable: true })
  bankAccountNumber?: string | null;

  @Column({ type: String, nullable: true })
  bankAccountHolder?: string | null;

  @Column({ type: String, nullable: true })
  bankBranch?: string | null;

  /**
   * A bank account change waiting for the emailed code (#005).
   * Shape: `{ values, otpHash, expiresAt, attempts, requestedAt }`.
   */
  @Column({ type: 'jsonb', nullable: true })
  pendingBankChange?: PendingBankChange | null;

  @DeleteDateColumn()
  deletedAt!: Date;
}
