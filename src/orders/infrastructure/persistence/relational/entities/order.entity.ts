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

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  referralDiscountVndAmount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  walletSpentVndAmount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  payableVndPrice!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  cashbackAmountVnd!: number;

  @Column({ type: String, default: MembershipTierEnum.TRAVELER })
  membershipTierSnapshot!: MembershipTierEnum;

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
