import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { RegionEntity } from '../../../../../regions/infrastructure/persistence/relational/entities/region.entity';

@Entity({
  name: 'destination',
})
export class DestinationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: String })
  name: string;

  @Column({ type: String, unique: true })
  slug: string;

  @Index()
  @Column({ type: String, length: 10 })
  countryCode: string;

  @ManyToMany(() => RegionEntity, { eager: true })
  @JoinTable({
    name: 'destination_region',
    joinColumn: { name: 'destinationId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'regionId', referencedColumnName: 'id' },
  })
  regions: RegionEntity[];

  @Column({ type: String, nullable: true })
  flagUrl: string | null;

  @Column({ type: String, nullable: true })
  avatarUrl: string | null;

  @Column({ type: String, nullable: true })
  keySearch: string | null;

  @Index()
  @Column({ type: Boolean, default: false })
  isPopular: boolean;

  @Index()
  @Column({ type: Boolean, default: true })
  isActive: boolean;

  @Column({ type: String, nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
