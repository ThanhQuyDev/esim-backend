import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { DestinationEntity } from '../../../../../destinations/infrastructure/persistence/relational/entities/destination.entity';
import { RegionEntity } from '../../../../../regions/infrastructure/persistence/relational/entities/region.entity';
import { PlanEntity } from '../../../../../plans/infrastructure/persistence/relational/entities/plan.entity';

@Entity({ name: 'seo_config' })
export class SeoConfigEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: String })
  url: string;

  @Column({ type: String, nullable: true })
  metaTitle: string | null;

  @Column({ type: 'text', nullable: true })
  metaDescription: string | null;

  @Column({ type: String, nullable: true })
  metaKeywords: string | null;

  @Column({ type: String, nullable: true })
  ogImage: string | null;

  @Column({ type: String, nullable: true })
  ogTitle: string | null;

  @Column({ type: 'text', nullable: true })
  ogDescription: string | null;

  @Column({ type: Number, nullable: true })
  destinationId: number | null;

  @ManyToOne(() => DestinationEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'destinationId' })
  destination: DestinationEntity | null;

  @Column({ type: Number, nullable: true })
  regionId: number | null;

  @ManyToOne(() => RegionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'regionId' })
  region: RegionEntity | null;

  @Column({ type: Number, nullable: true })
  planId: number | null;

  @ManyToOne(() => PlanEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'planId' })
  plan: PlanEntity | null;

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
