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
import { OrderRefundEntity } from './order-refund.entity';
import { UserSpendTransactionTypeEnum } from '../../../../tier/tier.enum';

@Entity({ name: 'user_spend_transaction' })
export class UserSpendTransactionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  userId!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Index()
  @Column({ type: Number, nullable: true })
  orderId!: number | null;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderId' })
  order?: OrderEntity | null;

  @Index()
  @Column({ type: Number, nullable: true })
  refundId!: number | null;

  @ManyToOne(() => OrderRefundEntity)
  @JoinColumn({ name: 'refundId' })
  refund?: OrderRefundEntity | null;

  @Index()
  @Column({ type: String })
  type!: UserSpendTransactionTypeEnum;

  @Column({ type: 'decimal', precision: 14, scale: 0 })
  amountVnd!: number;

  @Index({ unique: true })
  @Column({ type: String })
  idempotencyKey!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
