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
import { OrderEntity } from '../../../../../orders/infrastructure/persistence/relational/entities/order.entity';
import { PartnerEntity } from './partner.entity';
import { PartnerWalletEntity } from './partner-wallet.entity';
import { PartnerWalletTransactionTypeEnum } from '../../../../partners.enum';

@Entity({ name: 'partner_wallet_transaction' })
export class PartnerWalletTransactionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  walletId!: number;

  @ManyToOne(() => PartnerWalletEntity)
  @JoinColumn({ name: 'walletId' })
  wallet?: PartnerWalletEntity;

  @Index()
  @Column({ type: Number })
  partnerId!: number;

  @ManyToOne(() => PartnerEntity)
  @JoinColumn({ name: 'partnerId' })
  partner?: PartnerEntity;

  @Index()
  @Column({ type: String })
  type!: PartnerWalletTransactionTypeEnum;

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
