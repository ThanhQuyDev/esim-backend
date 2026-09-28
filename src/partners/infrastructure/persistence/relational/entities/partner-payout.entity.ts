import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PartnerEntity } from './partner.entity';
import { PartnerPayoutStatusEnum } from '../../../../partners.enum';

@Entity({ name: 'partner_payout' })
export class PartnerPayoutEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  partnerId!: number;

  @ManyToOne(() => PartnerEntity)
  @JoinColumn({ name: 'partnerId' })
  partner?: PartnerEntity;

  @Column({ type: 'decimal', precision: 14, scale: 0 })
  amountVnd!: number;

  /** The account as one line, kept for the rows created before #069. */
  @Column({ type: String, nullable: true })
  bankAccountInfo?: string | null;

  /**
   * The same account, snapshotted field by field (#069).
   *
   * The joined string is fine to show and useless to export or to print "4 số
   * đuôi" from, so each part is kept on its own. Null on old rows, where the
   * list falls back to the partner's current profile.
   */
  @Column({ type: String, nullable: true })
  bankName?: string | null;

  @Column({ type: String, nullable: true })
  bankAccountNumber?: string | null;

  @Column({ type: String, nullable: true })
  bankAccountHolder?: string | null;

  @Column({ type: String, nullable: true })
  bankBranch?: string | null;

  @Index()
  @Column({ type: String, default: PartnerPayoutStatusEnum.PENDING })
  status!: PartnerPayoutStatusEnum;

  @Column({ type: Number, nullable: true })
  processedByAdminId?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date | null;

  @Column({ type: String, nullable: true })
  adminNote?: string | null;

  @Column({ type: Number, nullable: true })
  walletTransactionId?: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
