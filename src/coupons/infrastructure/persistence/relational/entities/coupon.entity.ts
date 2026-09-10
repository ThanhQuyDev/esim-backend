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
import { PartnerEntity } from '../../../../../partners/infrastructure/persistence/relational/entities/partner.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { CouponDiscountType } from '../../../../coupon-discount';

@Entity({ name: 'coupon' })
export class CouponEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: String, length: 50, unique: true })
  code: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  discountPercent: number;

  /** 'percent' = % off, 'fixed' = a flat amount off in VND (#082). */
  @Column({ type: String, length: 16, default: 'percent' })
  discountType: CouponDiscountType;

  /** Flat amount off, used when `discountType` is 'fixed'. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  /** Ceiling for a percentage code ("15% off, up to 50k"); null = uncapped. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxDiscountAmount: number | null;

  @Column({ type: 'int', nullable: true })
  maxUsage: number | null;

  @Column({ type: 'int', nullable: true })
  maxUsagePerUser: number | null;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minOrderAmount: number | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Index()
  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @Index()
  @Column({ type: Boolean, default: false })
  isPopular: boolean;

  /**
   * Whether the code may be advertised on the cart page (#081). Private
   * codes still work when typed in — they are simply never listed.
   */
  @Index()
  @Column({ type: Boolean, default: true })
  isPublic: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Partner (KOL) this code belongs to; null for house-wide coupons. */
  @Index()
  @Column({ type: Number, nullable: true })
  partnerId?: number | null;

  @ManyToOne(() => PartnerEntity, { nullable: true })
  @JoinColumn({ name: 'partnerId' })
  partner?: PartnerEntity | null;

  @DeleteDateColumn()
  deletedAt: Date;
}
