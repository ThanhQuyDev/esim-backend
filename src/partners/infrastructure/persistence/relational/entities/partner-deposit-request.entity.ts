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
import { PartnerDepositRequestStatusEnum } from '../../../../partners.enum';

@Entity({ name: 'partner_deposit_request' })
export class PartnerDepositRequestEntity extends EntityRelationalHelper {
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

  @Index({ unique: true })
  @Column({ type: String })
  bankTransferCode!: string;

  @Index()
  @Column({ type: String, default: PartnerDepositRequestStatusEnum.PENDING })
  status!: PartnerDepositRequestStatusEnum;

  @Column({ type: Number, nullable: true })
  confirmedByAdminId?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date | null;

  @Column({ type: Number, nullable: true })
  walletTransactionId?: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
