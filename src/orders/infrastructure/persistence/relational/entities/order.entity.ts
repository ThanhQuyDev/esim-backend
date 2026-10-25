import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import {
  MembershipTierEnum,
  TierSourceEnum,
  MembershipTierCode,
} from '../../../../../wallets/tier/tier.enum';

@Entity({
  name: 'order',
})
export class OrderEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  userId!: number;

  @ManyToOne(() => UserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Index()
  @Column({ type: String, unique: true })
  orderNumber!: string;

  @Index()
  @Column({ type: String, default: 'pending' })
  status!: string;

  @Index()
  @Column({ type: String, default: 'BUY_NEW' })
  orderType!: string;

  @Index()
  @Column({ type: String, nullable: true })
  targetIccid?: string | null;

  @Column({ type: String, nullable: true })
  topupProvider?: string | null;

  @Column({ type: String, nullable: true })
  topupPackageId?: string | null;

  /**
   * What the topup package gave, snapshotted at checkout (#015).
   *
   * The provider catalogue changes and packages disappear, so an order has to
   * keep reporting the deal it was actually sold rather than whatever the
   * provider lists today.
   */
  @Column({ type: String, length: 300, nullable: true })
  topupPackageName?: string | null;

  @Column({ type: String, length: 60, nullable: true })
  topupDataText?: string | null;

  @Column({ type: 'int', nullable: true })
  topupDurationDays?: number | null;

  @Column({ type: Boolean, default: false })
  topupIsUnlimited!: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  @Column({ type: String, length: 3 })
  currency!: string;

  @Column({ type: String, nullable: true })
  paymentMethod?: string | null;

  @Column({ type: String, nullable: true })
  paymentId?: string | null;

  // Short, bank-friendly transfer code ([A-Z0-9], e.g. ESIM7K2M9P) used to
  // match an incoming SePay bank-transfer webhook back to this order. Null for
  // OnePay/wallet orders. Unique when present.
  @Index({ unique: true, where: '"bankTransferCode" IS NOT NULL' })
  @Column({ type: String, nullable: true })
  bankTransferCode?: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  couponCode?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  vndPrice!: number;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  vndCostPrice!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  subtotalVndPrice!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  couponDiscountVndAmount!: number;

  @Index()
  @Column({ type: String, nullable: true })
  referralCode?: string | null;

  @Index()
  @Column({ type: Number, nullable: true })
  referrerUserId?: number | null;

  // Partner-link (KOL marketing link) attribution — independent of the
  // referral/coupon codes above. Set when the buyer arrived via a
  // /go/[code] click on the public site within the attribution window.
  @Index()
  @Column({ type: String, nullable: true })
  partnerLinkCode?: string | null;

  @Index()
  @Column({ type: Number, nullable: true })
  attributedPartnerId?: number | null;

  /**
   * Who placed the order, as far as fraud watching goes (#036): a hash of the
   * network address and the browser's own id. The order still earns its
   * commission; `attributionWarning` marks the ones worth a look.
   */
  @Column({ type: String, nullable: true })
  buyerIpHash?: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  buyerVisitorId?: string | null;

  /** The buyer's browser when the order was placed (doitac-1410 #082). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string | null;

  /** desktop / mobile / tablet, for the overview chart (doitac-1410 #083). */
  @Index()
  @Column({ type: 'varchar', length: 16, nullable: true })
  deviceType?: string | null;

  @Column({ type: String, nullable: true })
  attributionWarning?: string | null;

  /** Where a partner order's eSIM QR codes go (doitac-1410 #034). */
  @Column({ type: String, nullable: true })
  deliveryEmail?: string | null;

  /**
   * The buyer's address and where it is, for "Vị trí & IP" on the admin
   * order page (vande #058) — "Ho Chi Minh City, Vietnam". Only orders a
   * customer places on the website have them.
   */
  @Column({ type: String, nullable: true })
  buyerIp?: string | null;

  @Column({ type: String, nullable: true })
  buyerLocation?: string | null;

  /**
   * Ordered in bulk from a file (vande #057): `email` — every eSIM mailed to
   * its customer, spaced `bulkEmailIntervalSec` apart; `file` — nothing
   * mailed, the eSIMs handed over as one downloadable list.
   */
  @Column({ type: String, nullable: true })
  bulkMode?: 'email' | 'file' | null;

  /** One upload — the orders whose emails are spaced out together. */
  @Index('IDX_order_bulkBatch')
  @Column({ type: String, nullable: true })
  bulkBatch?: string | null;

  @Column({ type: 'int', nullable: true })
  bulkEmailIntervalSec?: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  referralDiscountVndAmount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  walletSpentVndAmount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  payableVndPrice!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  cashbackAmountVnd!: number;

  @Column({ type: String, default: MembershipTierEnum.TRAVELER })
  membershipTierSnapshot!: MembershipTierCode;

  @Column({ type: String, default: TierSourceEnum.AUTOMATIC })
  tierSourceSnapshot!: TierSourceEnum;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2 })
  cashbackPercentSnapshot!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  eligibleSpendVnd!: number;

  @Column({ type: Number, nullable: true })
  cashbackTransactionId?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  cashbackReversedAt?: Date | null;

  @Column({ type: String, nullable: true })
  refundStatus?: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  refundedAmountVnd!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;
}
