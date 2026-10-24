import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { OrderEntity } from '../../../../../orders/infrastructure/persistence/relational/entities/order.entity';
import { PlanEntity } from '../../../../../plans/infrastructure/persistence/relational/entities/plan.entity';

@Entity({ name: 'order_item' })
export class OrderItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  orderId: number;

  @ManyToOne(() => OrderEntity, { eager: true })
  @JoinColumn({ name: 'orderId' })
  order: OrderEntity;

  @Index()
  @Column()
  planId: number;

  @ManyToOne(() => PlanEntity, { eager: true })
  @JoinColumn({ name: 'planId' })
  plan: PlanEntity;

  @Column({ type: String, nullable: true })
  orderRequestId: string | null;

  @Column({ type: String, nullable: true })
  providerOrderId: string | null;

  @Column({ type: String, nullable: true })
  providerOrderCode: string | null;

  @Index()
  @Column({ type: String, default: 'pending' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: String, length: 3 })
  currency: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  vndPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  vndCostPrice: number;

  @Column({ type: 'int', nullable: true, default: null })
  periodNum: number | null;

  /** Times the supplier was asked to take this line (vande #003). */
  @Column({ type: 'int', default: 0 })
  provisionAttempts: number;

  /** The supplier's last refusal, cleared once it takes the line. */
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  lastProvisionError: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastProvisionAttemptAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
