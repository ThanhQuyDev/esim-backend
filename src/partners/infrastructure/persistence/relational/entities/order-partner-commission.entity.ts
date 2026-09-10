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
import { OrderEntity } from '../../../../../orders/infrastructure/persistence/relational/entities/order.entity';
import { PartnerEntity } from './partner.entity';
import { PartnerLinkEntity } from './partner-link.entity';
import { OrderPartnerCommissionStatusEnum } from '../../../../partners.enum';

@Entity({ name: 'order_partner_commission' })
export class OrderPartnerCommissionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: Number })
  orderId!: number;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderId' })
  order?: OrderEntity;

  @Index()
  @Column({ type: Number })
  partnerId!: number;

  @ManyToOne(() => PartnerEntity)
  @JoinColumn({ name: 'partnerId' })
  partner?: PartnerEntity;

  @Index()
  @Column({ type: Number, nullable: true })
  linkId!: number | null;

  @ManyToOne(() => PartnerLinkEntity)
  @JoinColumn({ name: 'linkId' })
  link?: PartnerLinkEntity | null;

  @Column({ type: 'decimal', precision: 14, scale: 0 })
  commissionVnd!: number;

  @Column({ type: String, nullable: true })
  tierSnapshot!: string | null;

  @Index()
  @Column({ type: String, default: OrderPartnerCommissionStatusEnum.PENDING })
  status!: OrderPartnerCommissionStatusEnum;

  @Column({ type: Number, nullable: true })
  rewardTransactionId!: number | null;

  @Column({ type: Number, nullable: true })
  reversedTransactionId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
