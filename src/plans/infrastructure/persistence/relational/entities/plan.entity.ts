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
import { DestinationEntity } from '../../../../../destinations/infrastructure/persistence/relational/entities/destination.entity';
import { RegionEntity } from '../../../../../regions/infrastructure/persistence/relational/entities/region.entity';

@Entity({ name: 'plan' })
export class PlanEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: String })
  provider: string;

  @Column({ type: String })
  providerPlanId: string;

  @Column({ type: String })
  name: string;

  @Column({ type: String, unique: true })
  slug: string;

  @Index()
  @Column({ type: String, length: 10, nullable: true })
  countryCode: string | null;

  @Index()
  @Column({ type: Number, nullable: true })
  destinationId: number | null;

  @ManyToOne(() => DestinationEntity, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'destinationId' })
  destination: DestinationEntity | null;

  @Index()
  @Column({ type: Number, nullable: true })
  regionId: number | null;

  @ManyToOne(() => RegionEntity, {
    eager: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'regionId' })
  region: RegionEntity | null;

  @Column({ type: 'int' })
  durationDays: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  dataGb: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  costPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  retailPrice: number;

  @Column({ type: String, length: 3, default: 'USD' })
  currency: string;

  @Column({ type: String, default: 'data-in-total' })
  type: string;

  @Column({ type: Boolean, default: false })
  topUp: boolean;

  @Column({ type: String, nullable: true })
  speed: string | null;

  @Column({ type: String, nullable: true })
  operatorName: string | null;

  @Column({ type: String, nullable: true })
  fupSpeed: string | null;

  @Column({ type: Boolean, default: false })
  isAbleMultidate: boolean;

  @Column({ type: Boolean, default: false })
  isCheapest: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'bigint', default: 0 })
  vndPrice: number;

  @Column({ type: Boolean, default: false })
  isKyc: boolean;

  @Column({ type: String, nullable: true })
  apn: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

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
