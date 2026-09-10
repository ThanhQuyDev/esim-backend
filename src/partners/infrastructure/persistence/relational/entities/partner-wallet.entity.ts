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
import { PartnerWalletStatusEnum } from '../../../../partners.enum';

@Entity({ name: 'partner_wallet' })
export class PartnerWalletEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: Number, unique: true })
  partnerId!: number;

  @ManyToOne(() => PartnerEntity)
  @JoinColumn({ name: 'partnerId' })
  partner?: PartnerEntity;

  @Column({ type: 'decimal', precision: 14, scale: 0, default: 0 })
  balanceVnd!: number;

  @Index()
  @Column({ type: String, default: PartnerWalletStatusEnum.ACTIVE })
  status!: PartnerWalletStatusEnum;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
