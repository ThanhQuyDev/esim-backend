import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { OrderEntity } from '../../../../../orders/infrastructure/persistence/relational/entities/order.entity';
import { WalletTransactionEntity } from './wallet-transaction.entity';
import {
  OrderRefundModeEnum,
  OrderRefundStatusEnum,
} from '../../../../wallets.enum';

@Entity({ name: 'order_refund' })
export class OrderRefundEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  orderId!: number;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderId' })
  order?: OrderEntity;

  @Index()
  @Column({ type: Number })
  userId!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Index()
  @Column({ type: String })
  mode!: OrderRefundModeEnum;

  @Column({ type: 'decimal', precision: 14, scale: 0 })
  amountVnd!: number;

  @Index()
  @Column({ type: String, default: OrderRefundStatusEnum.COMPLETED })
  status!: OrderRefundStatusEnum;

  @Column({ type: String, nullable: true })
  reason!: string | null;

  @Column({ type: String, nullable: true })
  adminNote!: string | null;

  @Column({ type: Number, nullable: true })
  walletTransactionId!: number | null;

  @ManyToOne(() => WalletTransactionEntity)
  @JoinColumn({ name: 'walletTransactionId' })
  walletTransaction?: WalletTransactionEntity | null;

  @Column({ type: Number, nullable: true })
  createdByAdminId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
