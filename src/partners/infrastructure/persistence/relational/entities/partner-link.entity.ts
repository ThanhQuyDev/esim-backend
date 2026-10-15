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
import { PartnerEntity } from './partner.entity';
import { PartnerLinkStatusEnum } from '../../../../partners.enum';

@Entity({ name: 'partner_link' })
export class PartnerLinkEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  partnerId!: number;

  @ManyToOne(() => PartnerEntity)
  @JoinColumn({ name: 'partnerId' })
  partner?: PartnerEntity;

  @Index({ unique: true })
  @Column({ type: String })
  code!: string;

  @Column({ type: String })
  label!: string;

  @Column({ type: String, nullable: true })
  targetPath?: string | null;

  @Index()
  @Column({ type: String, default: PartnerLinkStatusEnum.ACTIVE })
  status!: PartnerLinkStatusEnum;

  /** The partner's own on/off, restored when the suspension lifts (#004). */
  @Column({ type: String, nullable: true })
  statusBeforeSuspend?: PartnerLinkStatusEnum | null;

  @Column({ type: 'int', default: 0 })
  clickCount!: number;

  @Column({ type: 'int', default: 0 })
  conversionCount!: number;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  totalCommissionVnd!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;
}
