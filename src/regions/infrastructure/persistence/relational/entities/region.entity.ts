import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { DestinationEntity } from '../../../../../destinations/infrastructure/persistence/relational/entities/destination.entity';

@Entity({ name: 'region' })
export class RegionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: String })
  name: string;

  @Column({ type: String, unique: true })
  slug: string;

  @Column({ type: String, nullable: true })
  slugVi: string | null;

  /**
   * Stable, provider-derived identity key (e.g. `esimaccess-cn`, `airalo-asia`).
   * Used by the cron sync to match an existing region regardless of CMS edits
   * to name/slug. Unique when present; nullable for manually created regions.
   */
  @Index()
  @Column({ type: String, unique: true, nullable: true })
  externalCode: string | null;

  @ManyToMany(() => DestinationEntity, (destination) => destination.regions)
  destinations: DestinationEntity[];

  @Column({ type: String, nullable: true })
  avatarUrl: string | null;

  @Column({ type: String, nullable: true })
  iconUrl: string | null;

  @Column({ type: String, nullable: true })
  description: string | null;

  @Column({ type: String, nullable: true })
  descriptionVi: string | null;

  @Index()
  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @Index()
  @Column({ type: Boolean, default: false })
  isPopular: boolean;

  @Column({ type: String, nullable: true })
  providers: string | null;

  @Column({ type: String, nullable: true })
  title: string | null;

  @Column({ type: String, nullable: true })
  titleVi: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
