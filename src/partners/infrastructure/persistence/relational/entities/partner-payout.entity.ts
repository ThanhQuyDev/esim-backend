import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PartnerEntity } from './partner.entity';
import { PartnerPayoutStatusEnum } from '../../../../partners.enum';

@Entity({ name: 'partner_payout' })
export class PartnerPayoutEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number })
  partnerId!: number;

  @ManyToOne(() => PartnerEntity)
  @JoinColumn({ name: 'partnerId' })
  partner?: PartnerEntity;

  @Column({ type: 'decimal', precision: 14, scale: 0 })
  amountVnd!: number;

  @Column({ type: String, nullable: true })
  bankAccountInfo?: string | null;

  @Index()
  @Column({ type: String, default: PartnerPayoutStatusEnum.PENDING })
  status!: PartnerPayoutStatusEnum;

  @Column({ type: Number, nullable: true })
  processedByAdminId?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date | null;

  @Column({ type: String, nullable: true })
  adminNote?: string | null;

  @Column({ type: Number, nullable: true })
  walletTransactionId?: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
