import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PartnerTypeEnum } from '../../../../partners.enum';

@Entity({ name: 'partner_tier' })
@Index(['partnerType', 'tierCode'], { unique: true })
export class PartnerTierEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: String })
  partnerType!: PartnerTypeEnum;

  @Column({ type: String })
  tierCode!: string;

  @Column({ type: String })
  tierName!: string;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  minVolumeVnd!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionPercent!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  maxDiscountPercent!: number;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Index()
  @Column({ type: Boolean, default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;
}
