import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PlanEntity } from '../../../../../plans/infrastructure/persistence/relational/entities/plan.entity';

@Entity({
  name: 'plan_price',
})
export class PlanPriceEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: Number })
  planId: number;

  @ManyToOne(() => PlanEntity, { eager: true })
  @JoinColumn({ name: 'planId' })
  plan: PlanEntity;

  @Column({ type: String, length: 3 })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  originalPrice: number | null;

  @Index()
  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
