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

@Entity({ name: 'coupon' })
export class CouponEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: String, length: 50, unique: true })
  code: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  discountPercent: number;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
