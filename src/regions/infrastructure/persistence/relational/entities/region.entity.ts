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

  @ManyToMany(() => DestinationEntity, (destination) => destination.regions)
  destinations: DestinationEntity[];

  @Column({ type: String, nullable: true })
  avatarUrl: string | null;

  @Column({ type: String, nullable: true })
  description: string | null;

  @Column({ type: String, nullable: true })
  descriptionVi: string | null;

  @Index()
  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @Column({ type: String, nullable: true })
  providers: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
