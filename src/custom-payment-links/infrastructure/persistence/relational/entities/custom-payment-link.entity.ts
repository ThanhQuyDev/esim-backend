import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { CustomPaymentLinkStatus } from '../../../../custom-payment-links.enum';

@Entity({
  name: 'custom_payment_link',
})
export class CustomPaymentLinkEntity extends EntityRelationalHelper {
  @Index()
  @Column({ type: Number, nullable: true })
  createdById?: number | null;

  @ManyToOne(() => UserEntity, { eager: true, nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: UserEntity | null;

  @Column({
    nullable: true,
    type: String,
  })
  paymentId?: string | null;

  @Index()
  @Column({
    nullable: false,
    type: String,
    default: CustomPaymentLinkStatus.PENDING,
  })
  status: string;

  @Column({
    nullable: true,
    type: String,
  })
  paymentUrl?: string | null;

  @Column({
    nullable: false,
    type: String,
  })
  description: string;

  @Column({
    nullable: false,
    type: String,
    default: 'VND',
  })
  currency: string;

  @Column({
    nullable: false,
    type: 'decimal',
    precision: 14,
    scale: 0,
  })
  amount: number;

  @Index()
  @Column({
    nullable: false,
    type: String,
  })
  customerEmail: string;

  @Index({ unique: true })
  @Column({
    nullable: false,
    type: String,
  })
  virtualOrderId: string;

  /** When an admin confirmed the outcome by hand (#056). */
  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date | null;

  /** Which admin confirmed it — a manual money decision must be attributable. */
  @Column({ type: Number, nullable: true })
  confirmedByAdminId?: number | null;

  /**
   * When the sweep gave up on it after OnePay's window (#056). Set only for an
   * auto-expiry, which is what lets a late successful IPN still be honoured
   * without overturning a real failure.
   */
  @Column({ type: 'timestamp', nullable: true })
  expiredAt?: Date | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
