import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PartnerEntity } from './partner.entity';

/** Outcome of one weekly tier review for one partner. */
@Entity({ name: 'partner_tier_evaluation' })
export class PartnerTierEvaluationEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  partnerId!: number;

  @ManyToOne(() => PartnerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partnerId' })
  partner?: PartnerEntity;

  @Column({ type: 'timestamp', default: () => 'now()' })
  evaluatedAt!: Date;

  /** Cumulative valid revenue the decision was made on. */
  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  revenueVnd!: number;

  @Column({ type: 'int', default: 0 })
  validOrders!: number;

  @Column({ type: String, nullable: true })
  tierBefore?: string | null;

  @Column({ type: String, nullable: true })
  tierAfter?: string | null;

  /** `promoted` | `unchanged` — demotion is deliberately not automatic. */
  @Column({ type: String })
  result!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
