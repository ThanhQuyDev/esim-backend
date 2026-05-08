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
import { UserWalletEntity } from './user-wallet.entity';
import { WalletTransactionTypeEnum } from '../../../../wallets.enum';

@Entity({ name: 'wallet_transaction' })
export class WalletTransactionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  walletId!: number;

  @ManyToOne(() => UserWalletEntity)
  @JoinColumn({ name: 'walletId' })
  wallet?: UserWalletEntity;

  @Index()
  @Column({ type: Number })
  userId!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Index()
  @Column({ type: String })
  type!: WalletTransactionTypeEnum;

  @Column({ type: 'decimal', precision: 14, scale: 0 })
  amountVnd!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0 })
  balanceAfterVnd!: number;

  @Index()
  @Column({ type: String, nullable: true })
  sourceType!: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  sourceId!: string | null;

  @Index()
  @Column({ type: Number, nullable: true })
  orderId!: number | null;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderId' })
  order?: OrderEntity | null;

  @Index()
  @Column({ type: Number, nullable: true })
  refUserId!: number | null;

  @Index()
  @Column({ type: String, unique: true, nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: String, nullable: true })
  reason!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: Number, nullable: true })
  createdByAdminId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
