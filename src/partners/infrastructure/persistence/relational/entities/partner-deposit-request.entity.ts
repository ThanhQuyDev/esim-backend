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
import { PartnerEntity, type PartnerDocument } from './partner.entity';
import {
  PartnerDepositRequestStatusEnum,
  PartnerTopupMethodEnum,
} from '../../../../partners.enum';

@Entity({ name: 'partner_deposit_request' })
export class PartnerDepositRequestEntity extends EntityRelationalHelper {
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

  /**
   * How the partner paid (#047). A bank transfer is credited in full; a card
   * payment carries OnePay's fee, which is why the three amounts below differ.
   */
  @Column({
    type: String,
    length: 20,
    default: PartnerTopupMethodEnum.BANK_TRANSFER,
  })
  method!: PartnerTopupMethodEnum;

  /** What the gateway charged, taken out of the amount sent (#047). */
  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  feeVnd!: number;

  /** What actually reaches the wallet: `amountVnd` less `feeVnd` (#047). */
  @Column({ type: 'decimal', precision: 14, scale: 0, nullable: true })
  creditedVnd!: number | null;

  /** The gateway's own reference, for reconciling against their report. */
  @Column({ type: String, length: 64, nullable: true })
  paymentId!: string | null;

  /**
   * The code the partner puts in the transfer memo, and the OnePay transaction
   * reference for a card payment.
   */
  @Index({ unique: true })
  @Column({ type: String })
  bankTransferCode!: string;

  @Index()
  @Column({ type: String, default: PartnerDepositRequestStatusEnum.PENDING })
  status!: PartnerDepositRequestStatusEnum;

  @Column({ type: Number, nullable: true })
  confirmedByAdminId?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date | null;

  @Column({ type: Number, nullable: true })
  walletTransactionId?: number | null;

  /** Why an admin refused it — shown in the partner's history (#063). */
  @Column({ type: String, length: 500, nullable: true })
  rejectionReason?: string | null;

  @Column({ type: Number, nullable: true })
  rejectedByAdminId?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt?: Date | null;

  /**
   * A manual top-up as the partner reported it (vande #069): the memo they
   * wrote on the transfer, a note for esim.vn, and the proof — screenshots or
   * the payment order. Kept outside the public uploads folder.
   */
  @Column({ type: String, length: 200, nullable: true })
  transferContent?: string | null;

  @Column({ type: String, length: 1000, nullable: true })
  partnerNote?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  proofFiles!: PartnerDocument[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
