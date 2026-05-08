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
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { OrderEntity } from '../../../../../orders/infrastructure/persistence/relational/entities/order.entity';
import { WalletTransactionEntity } from './wallet-transaction.entity';
import { OrderReferralStatusEnum } from '../../../../wallets.enum';

@Entity({ name: 'order_referral' })
export class OrderReferralEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number, unique: true })
  orderId!: number;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderId' })
  order?: OrderEntity;

  @Index()
  @Column({ type: Number })
  referrerUserId!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'referrerUserId' })
  referrer?: UserEntity;

  @Index()
  @Column({ type: Number })
  refereeUserId!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'refereeUserId' })
  referee?: UserEntity;

  @Index()
  @Column({ type: String, length: 50 })
  referralCode!: string;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 10000 })
  buyerDiscountVnd!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 10000 })
  rewardVnd!: number;

  @Index()
  @Column({ type: String, default: OrderReferralStatusEnum.PENDING })
  status!: OrderReferralStatusEnum;

  @Column({ type: Number, nullable: true })
  rewardTransactionId!: number | null;

  @ManyToOne(() => WalletTransactionEntity)
  @JoinColumn({ name: 'rewardTransactionId' })
  rewardTransaction?: WalletTransactionEntity | null;

  @Column({ type: Number, nullable: true })
  reversedTransactionId!: number | null;

  @ManyToOne(() => WalletTransactionEntity)
  @JoinColumn({ name: 'reversedTransactionId' })
  reversedTransaction?: WalletTransactionEntity | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
