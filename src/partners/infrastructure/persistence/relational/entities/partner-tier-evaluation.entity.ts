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

/** Outcome of one monthly tier review (or a change by hand) for one partner. */
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

  /**
   * The Vietnamese month (`YYYY-MM`) whose revenue was reviewed (vande #053);
   * null on a change made by hand and on the old weekly reviews.
   */
  @Index('IDX_partner_tier_evaluation_period')
  @Column({ type: String, nullable: true })
  period?: string | null;

  /** Valid revenue the decision was made on — that month's, since vande #053. */
  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  revenueVnd!: number;

  @Column({ type: 'int', default: 0 })
  validOrders!: number;

  @Column({ type: String, nullable: true })
  tierBefore?: string | null;

  @Column({ type: String, nullable: true })
  tierAfter?: string | null;

  /** `promoted` | `demoted` | `unchanged` | `manual` (set by an admin). */
  @Column({ type: String })
  result!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
